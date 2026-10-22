import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { category, post, postTag, tag } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type {
  CreatePostInput,
  PostDetail,
  PostItem,
  PostListParams,
  UpdatePostInput,
} from "./contracts";

type PostRow = Pick<
  typeof post.$inferSelect,
  | "id"
  | "title"
  | "slug"
  | "description"
  | "cover"
  | "status"
  | "isPinned"
  | "views"
  | "likes"
  | "wordCount"
  | "readingTime"
  | "publishedAt"
  | "createdAt"
  | "updatedAt"
>;

function iso(value: Date | null, fallback = 0): string {
  return (value ?? new Date(fallback)).toISOString();
}

function toItem(
  row: PostRow & { categoryName: string | null },
  tags: string[],
): PostItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? "",
    cover: row.cover ?? "",
    category: row.categoryName ?? "",
    tags,
    status: row.status ?? "draft",
    is_pinned: row.isPinned ?? false,
    views: row.views ?? 0,
    likes: row.likes ?? 0,
    word_count: row.wordCount ?? 0,
    reading_time: row.readingTime ?? 0,
    published_at: row.publishedAt?.toISOString() ?? null,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  };
}

function toDetail(
  row: PostRow & { categoryName: string | null; content: string | null },
  tags: string[],
): PostDetail {
  return {
    ...toItem(row, tags),
    content: row.content ?? "",
  };
}

async function loadTags(
  db: AppDatabase,
  postIds: number[],
): Promise<Map<number, string[]>> {
  if (postIds.length === 0) return new Map();

  const rows = await db
    .select({ postId: postTag.postId, name: tag.name })
    .from(postTag)
    .innerJoin(tag, eq(postTag.tagId, tag.id))
    .where(inArray(postTag.postId, postIds))
    .orderBy(tag.name);

  const result = new Map<number, string[]>();
  for (const row of rows) {
    const names = result.get(row.postId) ?? [];
    names.push(row.name);
    result.set(row.postId, names);
  }
  return result;
}

async function categoryIdBySlug(
  db: AppDatabase,
  slug: string,
): Promise<number | null> {
  const [row] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

async function taggedPostIds(
  db: AppDatabase,
  slug: string,
): Promise<number[] | null> {
  const [tagRow] = await db
    .select({ id: tag.id })
    .from(tag)
    .where(eq(tag.slug, slug))
    .limit(1);
  if (!tagRow) return null;

  const rows = await db
    .select({ postId: postTag.postId })
    .from(postTag)
    .where(eq(postTag.tagId, tagRow.id));
  return rows.map((row) => row.postId);
}

function tagSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function autoReadingTime(wordCount: number): number {
  return wordCount > 0 ? Math.max(1, Math.floor(wordCount / 300)) : 0;
}

export function createPostsService(db: AppDatabase) {
  async function loadDetailById(
    id: number,
    options: { publishedOnly?: boolean } = {},
  ): Promise<PostDetail> {
    const conditions = [eq(post.id, id)];
    if (options.publishedOnly) conditions.push(eq(post.status, "published"));

    const [row] = await db
      .select({
        id: post.id,
        title: post.title,
        slug: post.slug,
        description: post.description,
        content: post.content,
        cover: post.cover,
        status: post.status,
        isPinned: post.isPinned,
        views: post.views,
        likes: post.likes,
        wordCount: post.wordCount,
        readingTime: post.readingTime,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        categoryName: category.name,
      })
      .from(post)
      .leftJoin(category, eq(post.categoryId, category.id))
      .where(and(...conditions))
      .limit(1);

    if (!row) throw errors.notFound("文章不存在");

    const tagMap = await loadTags(db, [row.id]);
    return toDetail(row, tagMap.get(row.id) ?? []);
  }

  async function ensureCategory(id: number): Promise<void> {
    const [row] = await db
      .select({ id: category.id })
      .from(category)
      .where(eq(category.id, id))
      .limit(1);
    if (!row) throw errors.notFound("分类不存在");
  }

  async function assertSlugUnique(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const conditions = [eq(post.slug, slug)];
    if (excludeId !== undefined) conditions.push(ne(post.id, excludeId));

    const [row] = await db
      .select({ id: post.id })
      .from(post)
      .where(and(...conditions))
      .limit(1);
    if (row) throw errors.conflict("文章 slug 已存在");
  }

  async function syncTags(postId: number, names: string[]): Promise<void> {
    await db.delete(postTag).where(eq(postTag.postId, postId));

    const uniqueNames = [...new Set(names.map((name) => name.trim()))].filter(
      Boolean,
    );
    for (const name of uniqueNames) {
      let [tagRow] = await db
        .select({ id: tag.id })
        .from(tag)
        .where(eq(tag.name, name))
        .limit(1);

      if (!tagRow) {
        const slug = tagSlug(name);
        [tagRow] = await db
          .select({ id: tag.id })
          .from(tag)
          .where(eq(tag.slug, slug))
          .limit(1);

        if (!tagRow) {
          [tagRow] = await db
            .insert(tag)
            .values({ name, slug })
            .returning({ id: tag.id });
        }
      }

      if (!tagRow) throw errors.internal("保存标签失败");
      await db.insert(postTag).values({ postId, tagId: tagRow.id });
    }
  }

  async function recalcTaxonomyCounts(): Promise<void> {
    await db.run(sql`
      UPDATE "category"
      SET "post_count" = (
        SELECT COUNT(*) FROM "post"
        WHERE "post"."category_id" = "category"."id"
      )
    `);
    await db.run(sql`
      UPDATE "tag"
      SET "post_count" = (
        SELECT COUNT(*) FROM "post_tag"
        WHERE "post_tag"."tag_id" = "tag"."id"
      )
    `);
  }

  return {
    async list(params: PostListParams): Promise<PostItem[]> {
      const conditions = [
        params.status ? eq(post.status, params.status) : sql`1 = 1`,
      ];

      if (params.category) {
        const id = await categoryIdBySlug(db, params.category);
        if (id === null) return [];
        conditions.push(eq(post.categoryId, id));
      }

      if (params.tag) {
        const ids = await taggedPostIds(db, params.tag);
        if (ids === null || ids.length === 0) return [];
        conditions.push(inArray(post.id, ids));
      }

      const rows = await db
        .select({
          id: post.id,
          title: post.title,
          slug: post.slug,
          description: post.description,
          cover: post.cover,
          status: post.status,
          isPinned: post.isPinned,
          views: post.views,
          likes: post.likes,
          wordCount: post.wordCount,
          readingTime: post.readingTime,
          publishedAt: post.publishedAt,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          categoryName: category.name,
        })
        .from(post)
        .leftJoin(category, eq(post.categoryId, category.id))
        .where(and(...conditions))
        .orderBy(desc(post.isPinned), desc(post.createdAt), desc(post.id))
        .limit(params.size)
        .offset((params.page - 1) * params.size);

      const tagMap = await loadTags(
        db,
        rows.map((row) => row.id),
      );

      return rows.map((row) => toItem(row, tagMap.get(row.id) ?? []));
    },

    async getBySlug(
      slug: string,
      options: { publishedOnly?: boolean } = {},
    ): Promise<PostDetail> {
      const conditions = [eq(post.slug, slug)];
      if (options.publishedOnly) conditions.push(eq(post.status, "published"));

      const [row] = await db
        .select({
          id: post.id,
          title: post.title,
          slug: post.slug,
          description: post.description,
          content: post.content,
          cover: post.cover,
          status: post.status,
          isPinned: post.isPinned,
          views: post.views,
          likes: post.likes,
          wordCount: post.wordCount,
          readingTime: post.readingTime,
          publishedAt: post.publishedAt,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          categoryName: category.name,
        })
        .from(post)
        .leftJoin(category, eq(post.categoryId, category.id))
        .where(and(...conditions))
        .limit(1);

      if (!row) throw errors.notFound("文章不存在");

      // Views are intentionally not incremented on read. SSR prefetch would
      // inflate them; the client will report views separately later.
      const tagMap = await loadTags(db, [row.id]);
      return toDetail(row, tagMap.get(row.id) ?? []);
    },

    async getById(
      id: number,
      options: { publishedOnly?: boolean } = {},
    ): Promise<PostDetail> {
      return loadDetailById(id, options);
    },

    async create(input: CreatePostInput): Promise<PostDetail> {
      await assertSlugUnique(input.slug);
      if (input.category_id != null) await ensureCategory(input.category_id);

      const wordCount = input.word_count ?? input.content.length;
      const readingTime =
        input.reading_time ?? autoReadingTime(wordCount);
      const [row] = await db
        .insert(post)
        .values({
          title: input.title,
          slug: input.slug,
          description: input.description,
          content: input.content,
          cover: input.cover,
          categoryId: input.category_id ?? null,
          status: input.status,
          isPinned: input.is_pinned,
          wordCount,
          readingTime,
          publishedAt: input.status === "published" ? new Date() : null,
        })
        .returning({ id: post.id });
      if (!row) throw errors.internal("保存文章失败");

      await syncTags(row.id, input.tags);
      await recalcTaxonomyCounts();
      return loadDetailById(row.id);
    },

    async update(id: number, input: UpdatePostInput): Promise<PostDetail> {
      const [existing] = await db
        .select({
          id: post.id,
          content: post.content,
          status: post.status,
          publishedAt: post.publishedAt,
          wordCount: post.wordCount,
          categoryId: post.categoryId,
        })
        .from(post)
        .where(eq(post.id, id))
        .limit(1);
      if (!existing) throw errors.notFound("文章不存在");

      if (input.slug !== undefined) {
        await assertSlugUnique(input.slug, id);
      }
      if (input.category_id !== undefined && input.category_id !== null) {
        await ensureCategory(input.category_id);
      }

      const values: Partial<typeof post.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.title !== undefined) values.title = input.title;
      if (input.slug !== undefined) values.slug = input.slug;
      if (input.description !== undefined) {
        values.description = input.description;
      }
      if (input.content !== undefined) values.content = input.content;
      if (input.cover !== undefined) values.cover = input.cover;
      if (input.category_id !== undefined) {
        values.categoryId = input.category_id;
      }
      if (input.status !== undefined) values.status = input.status;
      if (input.is_pinned !== undefined) values.isPinned = input.is_pinned;

      let wordCount = existing.wordCount ?? 0;
      if (input.content !== undefined && input.word_count === undefined) {
        wordCount = input.content.length;
        values.wordCount = wordCount;
      }
      if (input.word_count !== undefined) {
        wordCount = input.word_count;
        values.wordCount = wordCount;
      }
      if (input.reading_time !== undefined) {
        values.readingTime = input.reading_time;
      } else if (
        input.content !== undefined ||
        input.word_count !== undefined
      ) {
        values.readingTime = autoReadingTime(wordCount);
      }

      const nextStatus = input.status ?? existing.status ?? "draft";
      if (nextStatus === "published" && !existing.publishedAt) {
        values.publishedAt = new Date();
      }

      const [row] = await db
        .update(post)
        .set(values)
        .where(eq(post.id, id))
        .returning({ id: post.id });
      if (!row) throw errors.notFound("文章不存在");

      if (input.tags !== undefined) {
        await syncTags(id, input.tags);
      }
      await recalcTaxonomyCounts();
      return loadDetailById(id);
    },

    async remove(id: number): Promise<{ ok: true }> {
      const [row] = await db
        .delete(post)
        .where(eq(post.id, id))
        .returning({ id: post.id });
      if (!row) throw errors.notFound("文章不存在");

      await recalcTaxonomyCounts();
      return { ok: true };
    },

    async listAllPublished(): Promise<
      Array<{ slug: string; updated_at: string }>
    > {
      const rows = await db
        .select({ slug: post.slug, updatedAt: post.updatedAt })
        .from(post)
        .where(eq(post.status, "published"))
        .orderBy(desc(post.updatedAt), desc(post.id));

      return rows.map((row) => ({
        slug: row.slug,
        updated_at: iso(row.updatedAt),
      }));
    },

    async count(status?: string): Promise<number> {
      const query = db
        .select({ value: sql<number>`count(*)` })
        .from(post);

      const [row] = status
        ? await query.where(eq(post.status, status))
        : await query;
      return row?.value ?? 0;
    },

    async like(id: number, unlike = false): Promise<{ likes: number }> {
      const delta = unlike ? -1 : 1;
      const [row] = await db
        .update(post)
        .set({
          likes: sql<number>`max(0, coalesce(${post.likes}, 0) + ${delta})`,
        })
        .where(and(eq(post.id, id), eq(post.status, "published")))
        .returning({ likes: post.likes });

      if (!row) throw errors.notFound("文章不存在");
      return { likes: row.likes ?? 0 };
    },

    /**
     * Atomic view increment. Called only from the client-side reporting route;
     * reading an article (including SSR prefetch) must never call this.
     */
    async incrementView(id: number): Promise<{ views: number }> {
      const [row] = await db
        .update(post)
        .set({
          views: sql<number>`coalesce(${post.views}, 0) + 1`,
        })
        .where(and(eq(post.id, id), eq(post.status, "published")))
        .returning({ views: post.views });

      if (!row) throw errors.notFound("文章不存在");
      return { views: row.views ?? 0 };
    },
  };
}

export type PostsService = ReturnType<typeof createPostsService>;
