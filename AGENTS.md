# Repository notes

## Project boundaries
- `Kirameku/` is the single-process Next.js 16 / React 19 application. It serves the public site, `/admin`, all `/api/*` Route Handlers, RSS, sitemap and local `/uploads/*` files from one Node process. `app/` contains pages and Route Handlers, `server/modules/` contains domain services, `server/db/` owns the SQLite/Drizzle schema and migrations, and `server/http|auth|storage/` hold shared infrastructure.
- There is no API proxy: `next.config.mjs` has no rewrites, so an unmatched `/api/*` or `/uploads/*` path returns 404. If a frontend request 404s, the handler is missing rather than proxied elsewhere.
- The former `Kirameku-backend/` legacy FastAPI/PostgreSQL stack was removed on 2026-10-22 after production cutover and the rollback window were confirmed. Do not reintroduce a second runtime; all new work belongs in `Kirameku/`.
- The root README describes the current single-process setup. For SQLite migrations, backups and restores, `Kirameku/server/db/README.md` is authoritative.

## Next.js app (`Kirameku/`)
- Use Node 22 and pnpm (CI uses pnpm 12.8.1); install with `pnpm install --frozen-lockfile` from this directory.
- Main checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. CI runs typecheck → tests → `pnpm db:migrate` → build; it does not run lint.
- Run one test with `pnpm exec vitest run server/modules/posts/service.test.ts` (replace with the test path).
- Copy `.env.example` to `.env.local` for the app and set `AUTH_SECRET` to at least 32 characters. Database scripts do not load `.env.local`; pass `DATABASE_PATH` in the command environment when using a non-default database.
- Deployment lives at the repository root. The image is built by GitHub Actions (`.github/workflows/release.yml`) and pushed to `ghcr.io/<owner>/kirameku`; the server only runs `docker compose pull` + `up -d`, never `docker build`. `docker-compose.yml` runs the app only: it publishes no host port and joins the external `kirameku-edge` network with the alias `kirameku-app`, so an existing reverse proxy — by default a Caddy container in a *different* compose project, which cannot reach the host loopback — proxies to `kirameku-app:3000`. A bundled Caddy is opt-in via `docker-compose.caddy.yml`. The image runs `pnpm start` (not `output: "standalone"`) so `tsx` and the `db:*` maintenance scripts stay available; the entrypoint runs `pnpm db:migrate` unless `RUN_MIGRATIONS=0`. SQLite, uploads and backups live under the `kirameku-data` volume at `/data`. Overrides: `docker-compose.build.yml` for local builds, `docker-compose.caddy.yml` to bundle Caddy, `docker-compose.host-proxy.yml` for a host-level (systemd) Caddy/Nginx that needs a published port. Pushes to `main` deploy automatically through `scripts/deploy-server.sh` (backup → pull → up → health check → rollback).
- `Kirameku/pnpm-workspace.yaml` sets `autoInstallPeers: false`; `@types/node` tracks Node 22. Keep both in sync with the runtime when upgrading Node.
- Server-only code imports `server-only`; Vitest aliases that package to `tests/server-only-stub.ts`.
- Markdown is rendered and sanitized on the server with `lib/markdown.ts`. Do not reintroduce client-side `marked` + `dangerouslySetInnerHTML`.

## SQLite migrations and data
- `server/db/schema/` is the typed schema source; migrations are numbered SQL files under `server/db/migrations/`. The initial migration is hand-written and has no Drizzle snapshot yet: do not run `pnpm db:generate` until a baseline snapshot has been created.
- Add a new migration rather than editing one already applied; the runner verifies stored SHA-256 hashes and rejects changed migrations.
- SQLite uses WAL. Never copy a live database file with `cp`; use `pnpm db:backup` / `pnpm db:restore` (stop the app before restore). See `server/db/README.md` for migration, backup and restore commands.
- Maintenance scripts: `pnpm db:prune-visitors` (IP retention) and `pnpm db:reconcile-counts` (denormalised counters).
