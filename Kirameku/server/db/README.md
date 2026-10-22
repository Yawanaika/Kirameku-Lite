# SQLite / Drizzle

SQLite / Drizzle foundation for the single-process application. The legacy
PostgreSQL stack and its one-off import scripts were removed on 2026-10-22;
this directory now owns the only database used by the app.

## Commands

```bash
# 0. First-time local setup
cp .env.example .env.local
# Set AUTH_SECRET (at least 32 chars) in .env.local.
# The db:* scripts do not load .env.local; pass DATABASE_PATH explicitly if
# you changed it from the default ./data/kirameku.db.
pnpm db:migrate

# 1. Create the first admin (no default password is shipped)
ADMIN_USERNAME=admin \
ADMIN_PASSWORD='replace-with-a-strong-password' \
pnpm db:seed-admin
# Re-running updates the password for an existing username.

# 2. Create/upgrade the local database
DATABASE_PATH=./data/kirameku.db pnpm db:migrate

# 3. Check the running app and latest migration
curl -s http://localhost:3000/api/health

# 4. Online backup + integrity check
DATABASE_PATH=./data/kirameku.db BACKUP_DIR=./backups pnpm db:backup --prune

# 5. Restore (stop the app first)
pnpm db:restore ./backups/kirameku-....db --target ./data/kirameku.db
```

`pnpm db:seed-admin` hashes with bcrypt (12 rounds) and rejects passwords
shorter than 12 characters or longer than bcrypt's 72-byte limit.

`pnpm db:restore` verifies the backup's `integrity_check`,
`foreign_key_check` and the SHA-256 in `<backup>.meta.json` before replacing
the target. It keeps the old database and its `-wal` / `-shm` files as
`.pre-restore-*`.

## Baseline note

`server/db/migrations/0000_initial.sql` is the hand-written P0 baseline. It
mirrors the legacy PostgreSQL schema's table names, field names and
nullability, using SQLite affinities. `server/db/schema/*` is the typed source
of truth for application code; `server/db/tables.ts` derives table metadata
from it for the migration tests.

The baseline intentionally has no Drizzle snapshot yet, so `pnpm db:generate`
stays guarded until a snapshot is created. Until then, add numbered `*.sql`
files under `server/db/migrations/` and let `server/db/migrate.ts` apply them.

Do not edit an already applied migration: the runner stores its SHA-256 and
will refuse to run if the file changed. In particular, historical comments in
`0000_initial.sql` and seed data in `0001_seed_projects.sql` are part of the
immutable migration history and must not be rewritten.

## Conventions

- Timestamps are `INTEGER` UTC epoch milliseconds.
- Booleans are `INTEGER` 0/1 (`drizzle` boolean mode).
- Foreign keys require `PRAGMA foreign_keys = ON` on every connection.
- `auto_vacuum = INCREMENTAL` is set before the first table is created.
- Never copy `kirameku.db` with `cp` while WAL is active; use `db.backup()`.
