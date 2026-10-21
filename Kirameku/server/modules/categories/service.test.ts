import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { createCategoriesService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let categories!: ReturnType<typeof createCategoriesService>;

function insertCategory(input: {
  name: string;
  slug: string;
  sort?: number;
  description?: string;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "category" ("name", "slug", "description", "sort", "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.name,
        input.slug,
        input.description ?? "",
        input.sort ?? 0,
        Date.UTC(2026, 0, 1),
        Date.UTC(2026, 0, 1),
      ).lastInsertRowid,
  );
}

function insertPost(input: {
  title: string;
  slug: string;
  status: string;
  categoryId: number;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "post" ("title", "slug", "category_id", "status", "created_at", "updated_at", "published_at")
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.slug,
        input.categoryId,
        input.status,
        Date.UTC(2026, 0, 1),
        Date.UTC(2026, 0, 1),
        Date.UTC(2026, 0, 1),
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-categories-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  const tools = insertCategory({
    name: "工具",
    slug: "tools",
    sort: 1,
    description: "常用工具",
  });
  insertCategory({ name: "阅读", slug: "reading", sort: 2 });
  insertPost({
    title: "Published",
    slug: "published",
    status: "published",
    categoryId: tools,
  });
  insertPost({
    title: "Draft",
    slug: "draft",
    status: "draft",
    categoryId: tools,
  });

  categories = createCategoriesService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("categories service", () => {
  it("lists categories ordered by sort with published post counts", async () => {
    const rows = await categories.list();

    expect(rows.map((row) => row.name)).toEqual(["工具", "阅读"]);
    expect(rows[0]).toMatchObject({
      name: "工具",
      slug: "tools",
      description: "常用工具",
      sort: 1,
      post_count: 1,
    });
    expect(rows[1].post_count).toBe(0);
  });

  it("creates, updates and deletes categories", async () => {
    const created = await categories.create({
      name: "新分类",
      slug: "new-category",
      description: "new",
      sort: 3,
    });
    expect(created).toMatchObject({
      name: "新分类",
      slug: "new-category",
      description: "new",
      sort: 3,
      post_count: 0,
    });

    const updated = await categories.update(created.id, {
      name: "重命名分类",
      sort: 4,
    });
    expect(updated).toMatchObject({
      name: "重命名分类",
      slug: "new-category",
      sort: 4,
      post_count: 0,
    });

    await expect(
      categories.create({
        name: "工具",
        slug: "another-slug",
        description: "",
        sort: 0,
      }),
    ).rejects.toMatchObject({ status: 409 });

    await expect(categories.remove(created.id)).resolves.toEqual({ ok: true });
    await expect(categories.remove(created.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("sets post category to null when a category is deleted", async () => {
    const rows = await categories.list();
    const tools = rows[0];

    await categories.remove(tools.id);
    const post = connection
      .prepare('SELECT "category_id" FROM "post" WHERE "slug" = ?')
      .get("published") as { category_id: number | null };
    expect(post.category_id).toBeNull();
  });
});
