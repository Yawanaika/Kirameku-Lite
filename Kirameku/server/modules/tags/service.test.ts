import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { createTagsService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let tags!: ReturnType<typeof createTagsService>;

function insertTag(name: string, slug: string): number {
  return Number(
    connection
      .prepare('INSERT INTO "tag" ("name", "slug") VALUES (?, ?)')
      .run(name, slug).lastInsertRowid,
  );
}

function insertPost(input: {
  title: string;
  slug: string;
  status: string;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "post" ("title", "slug", "status", "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.slug,
        input.status,
        Date.UTC(2026, 0, 1),
        Date.UTC(2026, 0, 1),
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-tags-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  const typescript = insertTag("TypeScript", "typescript");
  insertTag("React", "react");
  const published = insertPost({
    title: "Published",
    slug: "published",
    status: "published",
  });
  const draft = insertPost({
    title: "Draft",
    slug: "draft",
    status: "draft",
  });
  const insertPostTag = connection.prepare(
    'INSERT INTO "post_tag" ("post_id", "tag_id") VALUES (?, ?)',
  );
  insertPostTag.run(published, typescript);
  insertPostTag.run(draft, typescript);

  tags = createTagsService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("tags service", () => {
  it("lists tags ordered by published post count", async () => {
    const rows = await tags.list();

    expect(rows.map((row) => row.name)).toEqual(["TypeScript", "React"]);
    expect(rows[0]).toMatchObject({
      name: "TypeScript",
      slug: "typescript",
      post_count: 1,
    });
    expect(rows[1].post_count).toBe(0);
  });

  it("creates, updates and deletes tags", async () => {
    const created = await tags.create({ name: "SQLite", slug: "sqlite" });
    expect(created).toMatchObject({
      name: "SQLite",
      slug: "sqlite",
      post_count: 0,
    });

    const updated = await tags.update(created.id, {
      name: "SQLite 3",
      slug: "sqlite3",
    });
    expect(updated).toMatchObject({
      name: "SQLite 3",
      slug: "sqlite3",
      post_count: 0,
    });

    await expect(
      tags.create({ name: "TypeScript", slug: "another-slug" }),
    ).rejects.toMatchObject({ status: 409 });

    await expect(tags.remove(created.id)).resolves.toEqual({ ok: true });
    await expect(tags.remove(created.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("cascades post_tag rows when a tag is deleted", async () => {
    const rows = await tags.list();
    const typescript = rows[0];

    await tags.remove(typescript.id);
    const remaining = connection
      .prepare('SELECT COUNT(*) AS "count" FROM "post_tag" WHERE "tag_id" = ?')
      .get(typescript.id) as { count: number };
    expect(remaining.count).toBe(0);
  });
});
