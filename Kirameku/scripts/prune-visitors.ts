import fs from "node:fs";
import path from "node:path";
import { count, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../server/env";
import { openDatabase } from "../server/db/open";
import * as schema from "../server/db/schema";
import { createVisitorsService } from "../server/modules/visitors/service";

/**
 * Visitor records contain IP addresses and coarse geolocation. Run this daily
 * (cron) to enforce VISITOR_RETENTION_DAYS; defaults to 90 days.
 *
 * Usage: pnpm db:prune-visitors [--days 90] [--dry-run]
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const daysFlag = args.indexOf("--days");
  const days =
    daysFlag >= 0 ? Number(args[daysFlag + 1]) : env.VISITOR_RETENTION_DAYS;

  if (!Number.isSafeInteger(days) || days < 1) {
    throw new Error("--days must be a positive integer");
  }

  const databasePath = path.resolve(env.DATABASE_PATH);
  if (!fs.existsSync(databasePath)) {
    throw new Error(`database not found: ${databasePath}`);
  }

  const sqlite = openDatabase(databasePath);
  const db = drizzle(sqlite, { schema });

  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    if (dryRun) {
      const [row] = await db
        .select({ value: count() })
        .from(schema.visitor)
        .where(lt(schema.visitor.createdAt, cutoff));
      console.log(
        `dry-run: retention=${days}d cutoff=${cutoff.toISOString()} ` +
          `rows=${row?.value ?? 0} (database unchanged)`,
      );
      return;
    }

    const { deleted } = await createVisitorsService(db).pruneOlderThan(days);
    console.log(`deleted ${deleted} visitor record(s) older than ${days} days`);
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
