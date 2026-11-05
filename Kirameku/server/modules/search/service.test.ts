import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { createSearchService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let search: ReturnType<typeof createSearchService>;
let categoryId: number;

function insertPost(input: {
  title: string;
  slug: string;
  description?: string;
  content?: string;
  status?: string;
  publishedAt?: number;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "post"
          ("title", "slug", "description", "content", "status", "category_id", "published_at")
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.slug,
        input.description ?? "",
        input.content ?? "",
        input.status ?? "published",
        categoryId,
        input.publishedAt ?? Date.now(),
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-search-"));
  connection = openDatabase(path.join(directory, "kirameku.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });
  search = createSearchService(db);

  categoryId = Number(
    connection
      .prepare('INSERT INTO "category" ("name", "slug") VALUES (?, ?)')
      .run("技术", "tech").lastInsertRowid,
  );
});

afterEach(() => {
  connection.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("search service", () => {
  it("finds posts by CJK phrase through the FTS index", async () => {
    insertPost({
      title: "站内全文搜索的实现",
      slug: "fts",
      description: "讲怎么用 SQLite FTS5 做中文搜索",
      content: "这篇正文详细描述了 trigram 分词器的取舍。",
    });
    insertPost({
      title: "无关文章",
      slug: "other",
      content: "完全无关的内容。",
    });

    const result = await search.search({ q: "全文搜索", limit: 10 });

    expect(result.fuzzy).toBe(false);
    expect(result.total).toBe(1);
    expect(result.hits[0].slug).toBe("fts");
    expect(result.hits[0].snippet).toContain("trigram");
  });

  it("falls back to LIKE for queries shorter than three characters", async () => {
    insertPost({
      title: "搜索",
      slug: "short",
      content: "两个汉字也要能搜到。",
    });

    const result = await search.search({ q: "搜索", limit: 10 });

    expect(result.fuzzy).toBe(true);
    expect(result.hits.map((hit) => hit.slug)).toEqual(["short"]);
  });

  it("never returns drafts", async () => {
    insertPost({
      title: "草稿里的全文搜索",
      slug: "draft",
      status: "draft",
    });

    const draft = await search.search({ q: "全文搜索", limit: 10 });
    const fuzzyDraft = await search.search({ q: "草稿", limit: 10 });

    expect(draft.total).toBe(0);
    expect(fuzzyDraft.total).toBe(0);
  });

  it("ranks title matches above body-only matches", async () => {
    insertPost({
      title: "SQLite 使用笔记",
      slug: "body-only",
      content: "正文里顺带提到 sqlite 一次。",
      publishedAt: Date.now(),
    });
    insertPost({
      title: "SQLite",
      slug: "title-hit",
      content: "正文无关。",
      publishedAt: Date.now() - 86_400_000,
    });

    const result = await search.search({ q: "sqlite", limit: 10 });

    expect(result.hits.map((hit) => hit.slug)).toEqual([
      "title-hit",
      "body-only",
    ]);
  });

  it("keeps the index in sync when posts change or disappear", async () => {
    const id = insertPost({
      title: "初始标题全文搜索",
      slug: "sync",
      content: "初始正文",
    });

    connection
      .prepare('UPDATE "post" SET "title" = ? WHERE "id" = ?')
      .run("改过的标题全文搜索", id);
    expect((await search.search({ q: "改过", limit: 10 })).total).toBe(1);
    expect((await search.search({ q: "初始标题", limit: 10 })).total).toBe(0);

    connection.prepare('DELETE FROM "post" WHERE "id" = ?').run(id);
    expect((await search.search({ q: "改过", limit: 10 })).total).toBe(0);
  });

  it("survives FTS operator characters in the query", async () => {
    insertPost({
      title: '引号 " 与星号 * 的文章',
      slug: "operators",
      content: "带特殊字符的正文。",
    });

    for (const q of ['引号 "', "星号 *", '"; DROP', "NEAR(", "a AND b"]) {
      await expect(search.search({ q, limit: 5 })).resolves.toBeTruthy();
    }
  });

  it("returns an empty result for a blank query", async () => {
    const result = await search.search({ q: "   ", limit: 5 });

    expect(result).toEqual({ query: "", total: 0, hits: [], fuzzy: false });
  });
});
