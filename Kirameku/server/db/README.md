# SQLite / Drizzle

SQLite / Drizzle foundation for the single-process rewrite (P0 + P1).

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

# 4. Audit the production PostgreSQL schema against the SQLite metadata
DATABASE_URL=postgresql://... pnpm migrate:audit

# 5. Import a production PostgreSQL snapshot into a fresh SQLite target
DATABASE_URL=postgresql://... \
DATABASE_PATH=./data/kirameku.db \
pnpm migrate:pg2sqlite --target ./data/kirameku.db

# 6. Dry-run into a temporary DB (removed on success)
DATABASE_URL=postgresql://... pnpm migrate:pg2sqlite --dry-run

# 7. Online backup + integrity check
DATABASE_PATH=./data/kirameku.db BACKUP_DIR=./backups pnpm db:backup --prune

# 8. Restore (stop the app first)
pnpm db:restore ./backups/kirameku-....db --target ./data/kirameku.db
```

`pnpm db:seed-admin` hashes with bcrypt (12 rounds) and rejects passwords
shorter than 12 characters or longer than bcrypt's 72-byte limit.

`pnpm migrate:pg2sqlite` writes `backups/migration-manifest.json` with
`rowCount`, `maxId`, `contentHash`, `nullCounts` and `sqlite_sequence` for every
imported table. It exits non-zero on any mismatch.

Legacy timestamps are `timestamp without time zone` and are interpreted as
`Asia/Shanghai` with `EXTRACT(EPOCH FROM (col AT TIME ZONE 'Asia/Shanghai'))`.
Do not use `SET TIME ZONE` alone: `EXTRACT(EPOCH FROM timestamp)` ignores the
session timezone. The importer rejects `timestamp with time zone` columns rather
than silently applying the wrong conversion.

`pnpm db:restore` verifies the backup's `integrity_check`, `foreign_key_check`
and the SHA-256 in `<backup>.meta.json` before replacing the target. It keeps the
old database and its `-wal` / `-shm` files as `.pre-restore-*`.

## Baseline note

`server/db/migrations/0000_initial.sql` is the hand-written P0 baseline,
because the production PostgreSQL schema must be audited before the final
Drizzle snapshot is generated. `server/db/schema/*` is the typed source of
truth for application code; `server/db/tables.ts` derives the migration
metadata from it.

The hand-written baseline intentionally has no Drizzle snapshot yet, so
`pnpm db:generate` must not be used until the production audit is complete and a
snapshot has been created from the audited database. Until then, add numbered
`*.sql` files under `server/db/migrations/` and let `server/db/migrate.ts` apply
them. Do not edit an already applied migration: the runner stores its SHA-256
and will refuse to run if the file changed.

## Conventions

- Timestamps are `INTEGER` UTC epoch milliseconds.
- Booleans are `INTEGER` 0/1 (`drizzle` boolean mode).
- Foreign keys require `PRAGMA foreign_keys = ON` on every connection.
- `auto_vacuum = INCREMENTAL` is set before the first table is created.
- Never copy `kirameku.db` with `cp` while WAL is active; use `db.backup()`.
