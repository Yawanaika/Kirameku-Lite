# Repository notes

## Project boundaries
- `Kirameku/` is the single-process Next.js 16 / React 19 application. It serves the public site, `/admin`, all `/api/*` Route Handlers, RSS, sitemap and local `/uploads/*` files from one Node process. `app/` contains pages and Route Handlers, `server/modules/` contains domain services, `server/db/` owns the SQLite/Drizzle schema and migrations, and `server/http|auth|storage/` hold shared infrastructure.
- There is no API proxy: `next.config.mjs` has no rewrites, so an unmatched `/api/*` or `/uploads/*` path returns 404. If a frontend request 404s, the handler is missing rather than proxied elsewhere.
- `Kirameku-backend/` is the frozen legacy FastAPI/PostgreSQL stack, kept only as a rollback reference until production cutover and the T+7 rollback window have been confirmed. Do not add features or fix bugs there; new work belongs in `Kirameku/`.
- The root README describes the current single-process setup. For SQLite migrations, backups and restores, `Kirameku/server/db/README.md` is authoritative.

## Next.js app (`Kirameku/`)
- Use Node 22 and pnpm (CI uses pnpm 12.8.1); install with `pnpm install --frozen-lockfile` from this directory.
- Main checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. CI runs typecheck → tests → `pnpm db:migrate` → build; it does not run lint.
- Run one test with `pnpm exec vitest run server/modules/posts/service.test.ts` (replace with the test path).
- Copy `.env.example` to `.env.local` for the app and set `AUTH_SECRET` to at least 32 characters. Database scripts do not load `.env.local`; pass `DATABASE_PATH` in the command environment when using a non-default database.
- Server-only code imports `server-only`; Vitest aliases that package to `tests/server-only-stub.ts`.
- Markdown is rendered and sanitized on the server with `lib/markdown.ts`. Do not reintroduce client-side `marked` + `dangerouslySetInnerHTML`.

## SQLite migrations and data
- `server/db/schema/` is the typed schema source; migrations are numbered SQL files under `server/db/migrations/`. The initial migration is hand-written and has no Drizzle snapshot yet: do not run `pnpm db:generate` until the production schema audit and snapshot are complete.
- Add a new migration rather than editing one already applied; the runner verifies stored SHA-256 hashes and rejects changed migrations.
- SQLite uses WAL. Never copy a live database file with `cp`; use `pnpm db:backup` / `pnpm db:restore` (stop the app before restore). See `server/db/README.md` for migration, backup, restore, and PostgreSQL-import commands.
- Maintenance scripts: `pnpm db:prune-visitors` (IP retention) and `pnpm db:reconcile-counts` (denormalised counters).

## Legacy backend (`Kirameku-backend/`)
- Frozen. Its Vue admin in `Kirameku-backend/admin/` is a separate pnpm project with its own lockfile and is not part of CI. Do not run or extend it unless you are validating the rollback path.
- Removing the directory is an operational decision, not a refactor: it requires confirmed production cutover, a verified PostgreSQL backup, and the T+7 window to have passed.
