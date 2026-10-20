import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
}

interface MigrationRow {
  filename: string;
  sha256: string;
}

/**
 * Apply every unapplied `server/db/migrations/*.sql` file in filename order.
 *
 * A file is executed once, in an immediate transaction, and recorded in
 * `__migrations`. If an already-applied file changes, the run aborts instead of
 * silently drifting from the database.
 */
export function runMigrations(
  db: Database.Database,
  migrationsDir = path.join(process.cwd(), "server/db/migrations"),
): MigrationResult {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "__migrations" (
      "filename" TEXT PRIMARY KEY NOT NULL,
      "sha256" TEXT NOT NULL,
      "applied_at" INTEGER NOT NULL
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied: string[] = [];
  const alreadyApplied: string[] = [];
  const selectMigration = db.prepare(
    'SELECT "filename", "sha256" FROM "__migrations" WHERE "filename" = ?',
  );
  const insertMigration = db.prepare(
    'INSERT INTO "__migrations" ("filename", "sha256", "applied_at") VALUES (?, ?, ?)',
  );

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const sha256 = crypto.createHash("sha256").update(sql).digest("hex");
    const previous = selectMigration.get(file) as MigrationRow | undefined;

    if (previous) {
      if (previous.sha256 !== sha256) {
        throw new Error(
          `Migration ${file} has changed since it was applied. ` +
            "Create a new migration instead of editing an applied one.",
        );
      }
      alreadyApplied.push(file);
      continue;
    }

    const apply = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(file, sha256, Date.now());
    });

    apply.immediate();
    applied.push(file);
  }

  return { applied, alreadyApplied };
}
