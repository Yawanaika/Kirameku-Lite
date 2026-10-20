import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "../server/db/migrate";
import { openDatabase } from "../server/db/open";

const dbPath = process.env.DATABASE_PATH || "./data/kirameku.db";
const absolutePath = path.resolve(dbPath);

fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

const db = openDatabase(absolutePath);

try {
  const initialTableCount = (
    db
      .prepare(
        "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .get() as { count: number }
  ).count;

  if (initialTableCount === 0) {
    // auto_vacuum must be configured before the first table is created.
    db.pragma("auto_vacuum = INCREMENTAL");
    db.exec("VACUUM");
  }

  const result = runMigrations(db);

  for (const file of result.applied) {
    console.log(`applied ${file}`);
  }
  for (const file of result.alreadyApplied) {
    console.log(`already applied ${file}`);
  }

  const integrity = db.pragma("integrity_check") as Array<{
    integrity_check: string;
  }>;
  const integrityOk =
    integrity.length === 1 && integrity[0]?.integrity_check === "ok";

  if (!integrityOk) {
    throw new Error(
      `PRAGMA integrity_check failed: ${JSON.stringify(integrity)}`,
    );
  }

  const foreignKeyViolations = db
    .prepare("PRAGMA foreign_key_check")
    .all() as unknown[];
  if (foreignKeyViolations.length > 0) {
    throw new Error(
      `PRAGMA foreign_key_check found ${foreignKeyViolations.length} violation(s)`,
    );
  }

  const tableCount = (
    db
      .prepare(
        "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .get() as { count: number }
  ).count;

  console.log(`database ready: ${absolutePath}`);
  console.log(`tables: ${tableCount}`);
  console.log(
    `auto_vacuum: ${(db.pragma("auto_vacuum", { simple: true }) as number) === 2 ? "incremental" : "not incremental"}`,
  );
} finally {
  db.close();
}
