import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { createBookmarksService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let bookmarks!: ReturnType<typeof createBookmarksService>;

function insertCategory(input: {
  name: string;
  sort?: number;
  icon?: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number | null;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "bookmark_category"
          ("name", "icon", "description", "sort", "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.name,
        input.icon ?? "",
        input.description ?? "",
        input.sort ?? 0,
        input.createdAt ?? Date.UTC(2026, 0, 1),
        input.updatedAt === undefined ? Date.UTC(2026, 0, 1) : input.updatedAt,
      ).lastInsertRowid,
  );
}

function insertSite(input: {
  categoryId: number;
  name: string;
  url: string;
  platforms?: string;
  sort?: number;
  icon?: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number | null;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "bookmark_site"
          ("category_id", "name", "url", "icon", "description", "platforms",
           "sort", "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.categoryId,
        input.name,
        input.url,
        input.icon ?? "",
        input.description ?? "",
        input.platforms ?? "[]",
        input.sort ?? 0,
        input.createdAt ?? Date.UTC(2026, 0, 1),
        input.updatedAt === undefined ? Date.UTC(2026, 0, 1) : input.updatedAt,
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-bookmarks-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  const tools = insertCategory({
    name: "工具",
    sort: 1,
    description: "常用工具",
    createdAt: Date.UTC(2026, 0, 1),
    updatedAt: null,
  });
  const reading = insertCategory({
    name: "阅读",
    sort: 2,
    createdAt: Date.UTC(2026, 0, 2),
  });
  insertCategory({ name: "空分类", sort: 3 });

  insertSite({
    categoryId: tools,
    name: "Second",
    url: "https://second.example",
    platforms: '["web","mac"]',
    sort: 2,
  });
  insertSite({
    categoryId: tools,
    name: "First",
    url: "https://first.example",
    platforms: '["web"]',
    sort: 1,
    icon: "/first.png",
    description: "first site",
    createdAt: Date.UTC(2026, 0, 3),
  });
  insertSite({
    categoryId: reading,
    name: "Broken platforms",
    url: "https://broken.example",
    platforms: "not-json",
    sort: 1,
  });

  bookmarks = createBookmarksService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("bookmarks service", () => {
  it("groups sites under categories ordered by sort", async () => {
    const rows = await bookmarks.list();

    expect(rows.map((row) => row.name)).toEqual(["工具", "阅读", "空分类"]);
    expect(rows[0]).toMatchObject({
      name: "工具",
      description: "常用工具",
      updated_at: null,
    });
    expect(rows[0].sites.map((site) => site.name)).toEqual(["First", "Second"]);
    expect(rows[0].sites[0]).toMatchObject({
      category_id: rows[0].id,
      icon: "/first.png",
      description: "first site",
      platforms: ["web"],
      sort: 1,
      created_at: new Date(Date.UTC(2026, 0, 3)).toISOString(),
    });
    expect(rows[0].sites[1].platforms).toEqual(["web", "mac"]);
    expect(rows[2].sites).toEqual([]);
  });

  it("falls back to an empty platform list for invalid JSON", async () => {
    const rows = await bookmarks.list();
    expect(rows[1].sites[0].platforms).toEqual([]);
  });
});
