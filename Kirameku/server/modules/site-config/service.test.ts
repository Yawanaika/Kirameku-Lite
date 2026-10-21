import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { createSiteConfigService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let siteConfig!: ReturnType<typeof createSiteConfigService>;

function insertConfig(key: string, value: string): void {
  connection
    .prepare(
      `INSERT INTO "site_config" ("key", "value", "description", "updated_at")
       VALUES (?, ?, ?, ?)`,
    )
    .run(key, value, "", Date.UTC(2026, 0, 1));
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-site-config-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  insertConfig("cloud_music_playlist_id", "17943739323");
  insertConfig("theme", '{"mode":"dark"}');
  insertConfig("quoted", '"hello"');
  insertConfig("plain", "not-json");

  siteConfig = createSiteConfigService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("site config service", () => {
  it("returns a public key-value map with JSON values decoded", async () => {
    const config = await siteConfig.getPublic();

    expect(config).toEqual({
      cloud_music_playlist_id: 17943739323,
      theme: { mode: "dark" },
      quoted: "hello",
      plain: "not-json",
    });
  });
});
