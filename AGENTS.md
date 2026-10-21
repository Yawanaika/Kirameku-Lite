# Repository notes

## Project boundaries
- `Kirameku/` is the active Next.js 16 / React 19 app; its `app/` contains pages and Route Handlers, `server/modules/` contains domain services, and `server/db/` owns SQLite/Drizzle schema and migrations.
- `Kirameku-backend/` remains the legacy FastAPI/PostgreSQL app, with its Vue admin in `Kirameku-backend/admin/`. Next fallback rewrites proxy unmatched `/api/*` and `/uploads/*` requests to FastAPI on `127.0.0.1:8000`; check which side handles a route before changing a similarly named endpoint.
- The root README describes the older Postgres-centric setup. For the current Next/SQLite workflow, prefer package scripts, `.github/workflows/ci.yml`, and `Kirameku/server/db/README.md` over conflicting prose.

## Next.js app (`Kirameku/`)
- Use Node 22 and pnpm (CI uses pnpm 12.8.1); install with `pnpm install --frozen-lockfile` from this directory.
- Main checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. CI runs typecheck → tests → `pnpm db:migrate` → build; it does not run lint.
- Run one test with `pnpm exec vitest run server/modules/posts/service.test.ts` (replace with the test path).
- Copy `.env.example` to `.env.local` for the app and set `AUTH_SECRET` to at least 32 characters. Database scripts do not load `.env.local`; pass `DATABASE_PATH` in the command environment when using a non-default database.

## SQLite migrations and data
- `server/db/schema/` is the typed schema source; migrations are numbered SQL files under `server/db/migrations/`. The initial migration is hand-written and has no Drizzle snapshot yet: do not run `pnpm db:generate` until the production schema audit and snapshot are complete.
- Add a new migration rather than editing one already applied; the runner verifies stored SHA-256 hashes and rejects changed migrations.
- SQLite uses WAL. Never copy a live database file with `cp`; use `pnpm db:backup` / `pnpm db:restore` (stop the app before restore). See `server/db/README.md` for migration, backup, restore, and PostgreSQL-import commands.

## Legacy admin (`Kirameku-backend/admin/`)
- This is a separate pnpm project with its own lockfile; run its commands from that directory. `pnpm lint` runs ESLint/Prettier/Stylelint with autofix/write flags, so it can modify many files; `pnpm typecheck` and `pnpm build` are separate checks.
- The root CI workflow only verifies `Kirameku/`; it does not typecheck or test the FastAPI backend or Vue admin.
