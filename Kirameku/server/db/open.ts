import Database from "better-sqlite3";

export type DatabaseConnection = Database.Database;

/**
 * Open a SQLite connection with the project-wide PRAGMAs.
 *
 * `auto_vacuum` is intentionally not set here: it must be set before the first
 * table is created (see scripts/db-migrate.ts).
 */
export function openDatabase(
  file: string,
  options: Database.Options = {},
): DatabaseConnection {
  const db = new Database(file, options);

  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.pragma("cache_size = -20000");
  db.pragma("mmap_size = 268435456");
  db.pragma("temp_store = MEMORY");

  if (!options.readonly) {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
  }

  return db;
}
