import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { AppError } from "@/server/http/errors";
import { createCategoriesService } from "@/server/modules/categories/service";
import { createPostsService } from "./service";
import { createSiteStatsService } from "@/server/modules/site-stats/service";
import { createTagsService } from "@/server/modules/tags/service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let posts: ReturnType<typeof createPostsService>;
let categories: ReturnType<typeof createCategoriesService>;
let tags: ReturnType<typeof createTagsService>;
let stats: ReturnType<typeof createSiteStatsService>;
let techId: number;
let lifeId: number;
let typeScriptId: number;
let sqliteId: number;

function insertCategory(name: string, slug: string, sort: number): number {
  return Number(
    connection
      .prepare(
        'INSERT INTO "category" ("name", "slug", "sort", "post_count") VALUES (?, ?, ?, 0)',
      )
      .run(name, slug, sort).lastInsertRowid,
  );
}

function insertTag(name: string, slug: string): number {
  return Number(
    connection
      .prepare(
        'INSERT INTO "tag" ("name", "slug", "post_count") VALUES (?, ?, 0)',
      )
      .run(name, slug).lastInsertRowid,
  );
}

function insertPost(input: {
  title: string;
  slug: string;
  status: string;
  categoryId: number | null;
  isPinned?: boolean;
  views?: number;
  likes?: number;
  content?: string;
  createdAt: number;
  publishedAt?: number | null;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "post"
          ("title", "slug", "description", "content", "cover", "category_id",
           "status", "is_pinned", "views", "likes", "word_count", "reading_time",
           "published_at", "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.slug,
        `${input.title} description`,
        input.content ?? "",
        "",
        input.categoryId,
        input.status,
        input.isPinned ? 1 : 0,
        input.views ?? 0,
        input.likes ?? 0,
        10,
        1,
        input.publishedAt ?? null,
        input.createdAt,
        input.createdAt,
      ).lastInsertRowid,
  );
}

function linkTag(postId: number, tagId: number): void {
  connection
    .prepare('INSERT INTO "post_tag" ("post_id", "tag_id") VALUES (?, ?)')
    .run(postId, tagId);
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-posts-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  techId = insertCategory("Tech", "tech", 1);
  lifeId = insertCategory("Life", "life", 2);
  insertCategory("Empty", "empty", 3);
  typeScriptId = insertTag("TypeScript", "typescript");
  sqliteId = insertTag("SQLite", "sqlite");
  insertTag("Empty", "empty");

  const first = insertPost({
    title: "First",
    slug: "first",
    status: "published",
    categoryId: techId,
    isPinned: true,
    views: 7,
    likes: 2,
    content: "# First",
    createdAt: Date.UTC(2026, 0, 1),
    publishedAt: Date.UTC(2026, 0, 1),
  });
  const second = insertPost({
    title: "Second",
    slug: "second",
    status: "published",
    categoryId: lifeId,
    createdAt: Date.UTC(2026, 1, 1),
    publishedAt: Date.UTC(2026, 1, 1),
  });
  const third = insertPost({
    title: "Third",
    slug: "third",
    status: "published",
    categoryId: techId,
    createdAt: Date.UTC(2026, 1, 15),
    publishedAt: Date.UTC(2026, 1, 15),
  });
  insertPost({
    title: "Draft",
    slug: "draft",
    status: "draft",
    categoryId: techId,
    createdAt: Date.UTC(2026, 2, 1),
  });

  linkTag(first, typeScriptId);
  linkTag(first, sqliteId);
  linkTag(second, typeScriptId);
  linkTag(third, typeScriptId);
  connection.exec(
    `UPDATE category SET post_count = (SELECT COUNT(*) FROM post WHERE post.category_id = category.id AND post.status = 'published')`,
  );
  connection.exec(
    `UPDATE tag SET post_count = (SELECT COUNT(*) FROM post_tag JOIN post ON post.id = post_tag.post_id WHERE post_tag.tag_id = tag.id AND post.status = 'published')`,
  );

  connection
    .prepare(
      'INSERT INTO "chatter" ("content", "status", "created_at") VALUES (?, ?, ?)',
    )
    .run("published chatter", "published", Date.UTC(2026, 0, 1));
  connection
    .prepare(
      'INSERT INTO "chatter" ("content", "status", "created_at") VALUES (?, ?, ?)',
    )
    .run("draft chatter", "draft", Date.UTC(2026, 0, 2));

  const albumId = Number(
    connection
      .prepare('INSERT INTO "album" ("title") VALUES (?)')
      .run("Album").lastInsertRowid,
  );
  connection
    .prepare('INSERT INTO "photo" ("album_id", "url") VALUES (?, ?)')
    .run(albumId, "/one.jpg");
  connection
    .prepare('INSERT INTO "photo" ("album_id", "url") VALUES (?, ?)')
    .run(albumId, "/two.jpg");

  posts = createPostsService(db);
  categories = createCategoriesService(db);
  tags = createTagsService(db);
  stats = createSiteStatsService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("posts service", () => {
  it("lists only published posts, pinned first, with category and tags", async () => {
    const rows = await posts.list({
      status: "published",
      page: 1,
      size: 10,
    });

    expect(rows.map((row) => row.slug)).toEqual(["first", "third", "second"]);
    expect(rows[0]).toMatchObject({
      title: "First",
      category: "Tech",
      tags: ["SQLite", "TypeScript"],
      is_pinned: true,
      views: 7,
      likes: 2,
    });
    expect(rows[0]?.published_at).toBe(new Date(Date.UTC(2026, 0, 1)).toISOString());
  });

  it("supports pagination, category and tag filters", async () => {
    const firstPage = await posts.list({ status: "published", page: 1, size: 2 });
    const secondPage = await posts.list({ status: "published", page: 2, size: 2 });
    const life = await posts.list({
      status: "published",
      category: "life",
      page: 1,
      size: 10,
    });
    const tagged = await posts.list({
      status: "published",
      tag: "typescript",
      page: 1,
      size: 10,
    });

    expect(firstPage.map((row) => row.slug)).toEqual(["first", "third"]);
    expect(secondPage.map((row) => row.slug)).toEqual(["second"]);
    expect(life.map((row) => row.slug)).toEqual(["second"]);
    expect(tagged.map((row) => row.slug)).toEqual(["first", "third", "second"]);
  });

  it("returns an empty list for unknown filters", async () => {
    await expect(
      posts.list({ status: "published", category: "missing", page: 1, size: 10 }),
    ).resolves.toEqual([]);
    await expect(
      posts.list({ status: "published", tag: "missing", page: 1, size: 10 }),
    ).resolves.toEqual([]);
  });

  it("lists all published posts for sitemap generation", async () => {
    const rows = await posts.listAllPublished();

    expect(rows).toEqual([
      {
        slug: "third",
        updated_at: new Date(Date.UTC(2026, 1, 15)).toISOString(),
      },
      {
        slug: "second",
        updated_at: new Date(Date.UTC(2026, 1, 1)).toISOString(),
      },
      {
        slug: "first",
        updated_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      },
    ]);
  });

  it("counts by status", async () => {
    await expect(posts.count("published")).resolves.toBe(3);
    await expect(posts.count("draft")).resolves.toBe(1);
    await expect(posts.count()).resolves.toBe(4);
  });

  it("gets a published detail without incrementing views", async () => {
    const detail = await posts.getBySlug("first", { publishedOnly: true });

    expect(detail).toMatchObject({
      slug: "first",
      content: "# First",
      category: "Tech",
      tags: ["SQLite", "TypeScript"],
      views: 7,
    });

    const [row] = connection
      .prepare('SELECT "views" FROM "post" WHERE "slug" = ?')
      .all("first") as Array<{ views: number }>;
    expect(row.views).toBe(7);
  });

  it("hides drafts from public detail lookups", async () => {
    await expect(
      posts.getBySlug("draft", { publishedOnly: true }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      posts.getById(4, { publishedOnly: true }),
    ).rejects.toBeInstanceOf(AppError);

    const draft = await posts.getBySlug("draft");
    expect(draft.status).toBe("draft");
  });

  it("likes and unlikes published posts with a zero floor", async () => {
    await expect(posts.like(1)).resolves.toEqual({ likes: 3 });
    await expect(posts.like(1, true)).resolves.toEqual({ likes: 2 });
    await expect(posts.like(1, true)).resolves.toEqual({ likes: 1 });
    await expect(posts.like(1, true)).resolves.toEqual({ likes: 0 });
    await expect(posts.like(1, true)).resolves.toEqual({ likes: 0 });
    await expect(posts.like(4)).rejects.toBeInstanceOf(AppError);
  });

  it("deduplicates views per visitor, post and UTC day", async () => {
    await expect(posts.incrementView(1, "visitor-a", "2026-11-09")).resolves.toEqual({ counted: true, views: 8 });
    await expect(posts.incrementView(1, "visitor-a", "2026-11-09")).resolves.toEqual({ counted: false });
    await expect(posts.incrementView(1, "visitor-a", "2026-11-10")).resolves.toEqual({ counted: true, views: 9 });

    const [row] = connection
      .prepare('SELECT "views" FROM "post" WHERE "id" = ?')
      .all(1) as Array<{ views: number }>;
    expect(row.views).toBe(9);
    const [dedupe] = connection
      .prepare('SELECT COUNT(*) AS "count" FROM "post_view" WHERE "post_id" = ?')
      .all(1) as Array<{ count: number }>;
    expect(dedupe.count).toBe(2);

    await expect(posts.incrementView(4, "visitor-a", "2026-11-09")).rejects.toBeInstanceOf(AppError);
    await expect(posts.incrementView(999, "visitor-a", "2026-11-09")).rejects.toBeInstanceOf(AppError);
  });

  it("rolls back the dedupe claim when incrementing views fails", async () => {
    connection.exec([
      "CREATE TRIGGER fail_post_view_update",
      "BEFORE UPDATE OF views ON post WHEN OLD.id = 1",
      "BEGIN SELECT RAISE(ABORT, 'simulated view update failure'); END;",
    ].join("\n"));

    await expect(
      posts.incrementView(1, "retry-visitor", "2026-11-09"),
    ).rejects.toThrow("simulated view update failure");
    const [beforeRetry] = connection
      .prepare('SELECT COUNT(*) AS "count" FROM "post_view" WHERE "visitor_key" = ?')
      .all("retry-visitor") as Array<{ count: number }>;
    expect(beforeRetry.count).toBe(0);

    connection.exec("DROP TRIGGER fail_post_view_update");
    await expect(
      posts.incrementView(1, "retry-visitor", "2026-11-09"),
    ).resolves.toEqual({ counted: true, views: 8 });
  });

  it("lists drafts and all statuses for the admin view", async () => {
    const all = await posts.list({ page: 1, size: 10 });
    const drafts = await posts.list({
      status: "draft",
      page: 1,
      size: 10,
    });

    expect(all.map((row) => row.slug)).toEqual([
      "first",
      "draft",
      "third",
      "second",
    ]);
    expect(drafts.map((row) => row.slug)).toEqual(["draft"]);
  });

  it("creates a post with automatic counts and tag syncing", async () => {
    const created = await posts.create({
      title: "New Post",
      slug: "new-post",
      description: "new description",
      content: "你好世界",
      cover: "/new.png",
      category_id: techId,
      tags: ["TypeScript", "新标签", "新标签", "  "],
      status: "draft",
      is_pinned: false,
    });

    expect(created).toMatchObject({
      title: "New Post",
      slug: "new-post",
      description: "new description",
      content: "你好世界",
      cover: "/new.png",
      category: "Tech",
      tags: ["TypeScript", "新标签"],
      status: "draft",
      is_pinned: false,
      word_count: 4,
      reading_time: 1,
      published_at: null,
    });

    const published = await posts.create({
      title: "Published Post",
      slug: "published-post",
      description: "",
      content: "a".repeat(600),
      cover: "",
      category_id: null,
      tags: [],
      status: "published",
      is_pinned: true,
    });
    expect(published.published_at).not.toBeNull();
    expect(published.word_count).toBe(600);
    expect(published.reading_time).toBe(2);

    await expect(
      posts.create({
        title: "Duplicate",
        slug: "new-post",
        description: "",
        content: "",
        cover: "",
        category_id: null,
        tags: [],
        status: "draft",
        is_pinned: false,
      }),
    ).rejects.toMatchObject({ status: 409 });

    await expect(
      posts.create({
        title: "Missing Category",
        slug: "missing-category",
        description: "",
        content: "",
        cover: "",
        category_id: 999999,
        tags: [],
        status: "draft",
        is_pinned: false,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("updates content, tags, category and publish state", async () => {
    const created = await posts.create({
      title: "Editable",
      slug: "editable",
      description: "",
      content: "short",
      cover: "",
      category_id: techId,
      tags: ["TypeScript"],
      status: "draft",
      is_pinned: false,
    });

    const updated = await posts.update(created.id, {
      content: "b".repeat(600),
      tags: ["SQLite", "另一个标签"],
      category_id: lifeId,
      status: "published",
      is_pinned: true,
    });

    expect(updated).toMatchObject({
      slug: "editable",
      content: "b".repeat(600),
      category: "Life",
      tags: ["SQLite", "另一个标签"],
      status: "published",
      is_pinned: true,
      word_count: 600,
      reading_time: 2,
    });
    expect(updated.published_at).not.toBeNull();

    // 发布时间语义：撤稿不清空、再次发布不改写，只有第一次发布才落时间戳。
    const firstPublishedAt = updated.published_at;
    const unpublished = await posts.update(created.id, { status: "draft" });
    expect(unpublished.status).toBe("draft");
    expect(unpublished.published_at).toBe(firstPublishedAt);
    const republished = await posts.update(created.id, { status: "published" });
    expect(republished.published_at).toBe(firstPublishedAt);

    await expect(
      posts.update(created.id, { slug: "first" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      posts.update(created.id, { category_id: 999999 }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(posts.update(999999, { title: "missing" })).rejects.toMatchObject(
      { status: 404 },
    );
  });

  it("respects manually supplied word count and reading time", async () => {
    const created = await posts.create({
      title: "Manual Counts",
      slug: "manual-counts",
      description: "",
      content: "abc",
      cover: "",
      category_id: null,
      tags: [],
      status: "draft",
      is_pinned: false,
      word_count: 999,
      reading_time: 7,
    });

    expect(created.word_count).toBe(999);
    expect(created.reading_time).toBe(7);
  });

  it("updates only affected published taxonomy counters", async () => {
    const created = await posts.create({
      title: "Counter Check",
      slug: "counter-check",
      description: "",
      content: "content",
      cover: "",
      category_id: techId,
      tags: ["TypeScript", "SQLite"],
      status: "published",
      is_pinned: false,
    });
    const postCount = (table: "category" | "tag", id: number) =>
      (connection
        .prepare(`SELECT "post_count" AS "count" FROM "${table}" WHERE "id" = ?`)
        .get(id) as { count: number }).count;

    expect(postCount("category", techId)).toBe(3);
    expect(postCount("tag", typeScriptId)).toBe(4);
    expect(postCount("tag", sqliteId)).toBe(2);

    await posts.update(created.id, {
      status: "draft",
      category_id: lifeId,
      tags: ["SQLite"],
    });
    expect(postCount("category", techId)).toBe(2);
    expect(postCount("category", lifeId)).toBe(1);
    expect(postCount("tag", typeScriptId)).toBe(3);
    expect(postCount("tag", sqliteId)).toBe(1);

    await posts.update(created.id, { status: "published" });
    expect(postCount("category", lifeId)).toBe(2);
    expect(postCount("tag", sqliteId)).toBe(2);
    await posts.update(created.id, { tags: ["TypeScript"] });
    expect(postCount("tag", sqliteId)).toBe(1);
    expect(postCount("tag", typeScriptId)).toBe(4);

    await posts.remove(created.id);
    expect(postCount("category", lifeId)).toBe(1);
    expect(postCount("tag", typeScriptId)).toBe(3);
  });

  it("keeps autosaved drafts separate, records revisions, restores, and runs schedules", async () => {
    const created = await posts.create({
      title: "Versioned", slug: "versioned", description: "", content: "published text",
      cover: "", category_id: techId, tags: [], status: "published", is_pinned: false,
    });
    await posts.saveDraft(created.id, {
      title: "Working copy", slug: "versioned", description: "draft", content: "uncommitted",
      cover: "", category_id: techId, tags: [], status: "published",
      scheduled_at: null, is_pinned: false,
    });
    expect((await posts.getById(created.id)).content).toBe("published text");
    expect((await posts.getDraft(created.id))?.content).toBe("uncommitted");

    await posts.update(created.id, { content: "committed" });
    const history = await posts.listRevisions(created.id);
    expect(history[0]?.snapshot.content).toBe("committed");
    expect(history[1]?.snapshot.content).toBe("published text");
    await posts.restoreRevision(created.id, history[1]!.id);
    expect((await posts.getDraft(created.id))?.content).toBe("published text");
    expect((await posts.getById(created.id)).content).toBe("committed");

    await posts.update(created.id, {
      status: "scheduled", scheduled_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await posts.runDuePostSchedules()).toBe(1);
    expect((await posts.getById(created.id)).status).toBe("published");
    expect(await posts.runDuePostSchedules()).toBe(0);
    await posts.update(created.id, {
      status: "unpublish_scheduled", scheduled_at: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(posts.getBySlug("versioned", { publishedOnly: true })).resolves.toMatchObject({
      status: "unpublish_scheduled", content: "committed",
    });
    expect(await posts.runDuePostSchedules()).toBe(1);
    expect((await posts.getById(created.id)).status).toBe("archived");
  });

  it("deletes a post and its tag links", async () => {
    const created = await posts.create({
      title: "Delete Me",
      slug: "delete-me",
      description: "",
      content: "content",
      cover: "",
      category_id: techId,
      tags: ["TypeScript"],
      status: "draft",
      is_pinned: false,
    });

    await expect(posts.remove(created.id)).resolves.toEqual({ ok: true });
    await expect(posts.getById(created.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(posts.remove(created.id)).rejects.toMatchObject({
      status: 404,
    });

    const links = connection
      .prepare('SELECT COUNT(*) AS "count" FROM "post_tag" WHERE "post_id" = ?')
      .get(created.id) as { count: number };
    expect(links.count).toBe(0);
  });
});

describe("taxonomy and site stats", () => {
  it("lists categories with published post counts", async () => {
    const rows = await categories.list();

    expect(rows.map((row) => row.slug)).toEqual(["tech", "life", "empty"]);
    expect(rows.find((row) => row.slug === "tech")?.post_count).toBe(2);
    expect(rows.find((row) => row.slug === "life")?.post_count).toBe(1);
    expect(rows.find((row) => row.slug === "empty")?.post_count).toBe(0);
  });

  it("lists tags ordered by published post count", async () => {
    const rows = await tags.list();

    expect(rows[0]).toMatchObject({
      name: "TypeScript",
      post_count: 3,
    });
    expect(rows.find((row) => row.slug === "sqlite")?.post_count).toBe(1);
    expect(rows.find((row) => row.slug === "empty")?.post_count).toBe(0);
  });

  it("returns public site counts", async () => {
    await expect(stats.get()).resolves.toEqual({
      postCount: 3,
      chatterCount: 1,
      photoCount: 2,
    });
  });
});
