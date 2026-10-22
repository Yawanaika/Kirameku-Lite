import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../server/env";
import { openDatabase } from "../server/db/open";
import * as schema from "../server/db/schema";
import type { AppDatabase } from "../server/db/types";

/**
 * Repair denormalised counters that are read directly by the UI.
 *
 * - `chatter.comments_count` and `album.photo_count` are read from the row, so
 *   drift is visible. Recompute them from the source tables.
 * - `category.post_count` / `tag.post_count` are recomputed on read, but keep the
 *   stored values consistent as published-only counts (matching the read path).
 *
 * Usage: pnpm db:reconcile-counts [--dry-run]
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const databasePath = path.resolve(env.DATABASE_PATH);
  if (!fs.existsSync(databasePath)) {
    throw new Error(`database not found: ${databasePath}`);
  }

  const sqlite = openDatabase(databasePath);
  const db = drizzle(sqlite, { schema });

  try {
    const tables = {
      category: await countRows(db, schema.category),
      tag: await countRows(db, schema.tag),
      chatter: await countRows(db, schema.chatter),
      album: await countRows(db, schema.album),
    };

    if (dryRun) {
      console.log("dry-run: counters would be recomputed for", tables);
      return;
    }

    // Independent UPDATE statements; a partial run is safe to repeat.
    await db.run(sql`
      UPDATE "category" SET "post_count" = (
        SELECT COUNT(*) FROM "post"
        WHERE "post"."category_id" = "category"."id"
          AND "post"."status" = 'published'
      )
    `);
    await db.run(sql`
      UPDATE "tag" SET "post_count" = (
        SELECT COUNT(*) FROM "post_tag"
        JOIN "post" ON "post"."id" = "post_tag"."post_id"
        WHERE "post_tag"."tag_id" = "tag"."id"
          AND "post"."status" = 'published'
      )
    `);
    await db.run(sql`
      UPDATE "chatter" SET "comments_count" = (
        SELECT COUNT(*) FROM "chatter_comment"
        WHERE "chatter_comment"."chatter_id" = "chatter"."id"
      )
    `);
    await db.run(sql`
      UPDATE "album" SET "photo_count" = (
        SELECT COUNT(*) FROM "photo"
        WHERE "photo"."album_id" = "album"."id"
      )
    `);

    console.log(`recomputed counters for ${JSON.stringify(tables)}`);
  } finally {
    sqlite.close();
  }
}

async function countRows(
  db: AppDatabase,
  table:
    | typeof schema.category
    | typeof schema.tag
    | typeof schema.chatter
    | typeof schema.album,
): Promise<number> {
  const [row] = await db.select({ value: sql<number>`count(*)` }).from(table);
  return row?.value ?? 0;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
