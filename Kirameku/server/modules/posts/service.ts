import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { category, post, postTag, tag } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type { PostDetail, PostItem, PostListParams } from "./contracts";

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

export function createPostsService(db: AppDatabase) {
  return {
    async list(params: PostListParams): Promise<PostItem[]> {
      const conditions = [eq(post.status, params.status)];

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
  };
}

export type PostsService = ReturnType<typeof createPostsService>;
