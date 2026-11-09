import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { category, post, postDraft, postRevision, postTag, postView, tag } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import { applyLike } from "@/server/modules/likes/service";
import type {
  CreatePostInput,
  PostDetail,
  PostItem,
  PostListParams,
  UpdatePostInput,
  PostSnapshot,
  PostStatus,
} from "./contracts";

type PostRow = Pick<
  typeof post.$inferSelect,
  | "id"
  | "title"
  | "slug"
  | "description"
  | "cover"
  | "status"
  | "categoryId"
  | "scheduledAt"
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
    category_id: row.categoryId ?? null,
    scheduled_at: row.scheduledAt?.toISOString() ?? null,
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
  function toSnapshot(detail: PostDetail): PostSnapshot {
    return {
      title: detail.title, slug: detail.slug, description: detail.description,
      content: detail.content, cover: detail.cover, category_id: detail.category_id,
      tags: detail.tags, status: detail.status as PostStatus,
      scheduled_at: detail.scheduled_at, is_pinned: detail.is_pinned,
    };
  }

  async function recordRevision(id: number): Promise<void> {
    const detail = await loadDetailById(id);
    const snapshot = toSnapshot(detail);
    const [latest] = await db.select({ snapshot: postRevision.snapshot })
      .from(postRevision).where(eq(postRevision.postId, id))
      .orderBy(desc(postRevision.createdAt), desc(postRevision.id)).limit(1);
    if (latest && JSON.stringify(latest.snapshot) === JSON.stringify(snapshot)) return;
    await db.insert(postRevision).values({ postId: id, snapshot });
  }

  async function loadDetailById(
    id: number,
    options: { publishedOnly?: boolean } = {},
  ): Promise<PostDetail> {
    const conditions = [eq(post.id, id)];
    if (options.publishedOnly) conditions.push(inArray(post.status, ["published", "unpublish_scheduled"]));

    const [row] = await db
      .select({
        id: post.id,
        title: post.title,
        slug: post.slug,
        description: post.description,
        content: post.content,
        cover: post.cover,
        status: post.status,
        categoryId: post.categoryId,
        scheduledAt: post.scheduledAt,
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

  async function syncTags(postId: number, names: string[]): Promise<number[]> {
    await db.delete(postTag).where(eq(postTag.postId, postId));

    const tagIds: number[] = [];
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
      tagIds.push(tagRow.id);
    }
    return tagIds;
  }

  async function tagIdsForPost(postId: number): Promise<number[]> {
    const rows = await db
      .select({ tagId: postTag.tagId })
      .from(postTag)
      .where(eq(postTag.postId, postId));
    return rows.map((row) => row.tagId);
  }

  async function applyTaxonomyCountDeltas(
    categoryDeltas: Map<number, number>,
    tagDeltas: Map<number, number>,
  ): Promise<void> {
    for (const [categoryId, delta] of categoryDeltas) {
      if (delta === 0) continue;
      await db
        .update(category)
        .set({
          postCount: sql<number>`max(0, coalesce(${category.postCount}, 0) + ${delta})`,
        })
        .where(eq(category.id, categoryId));
    }
    for (const [tagId, delta] of tagDeltas) {
      if (delta === 0) continue;
      await db
        .update(tag)
        .set({
          postCount: sql<number>`max(0, coalesce(${tag.postCount}, 0) + ${delta})`,
        })
        .where(eq(tag.id, tagId));
    }
  }

  return {
    async list(params: PostListParams): Promise<PostItem[]> {
      const conditions = [
        params.status === "published"
          ? inArray(post.status, ["published", "unpublish_scheduled"])
          : params.status ? eq(post.status, params.status) : sql`1 = 1`,
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
          categoryId: post.categoryId,
          scheduledAt: post.scheduledAt,
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
      if (options.publishedOnly) conditions.push(inArray(post.status, ["published", "unpublish_scheduled"]));

      const [row] = await db
        .select({
          id: post.id,
          title: post.title,
          slug: post.slug,
          description: post.description,
          content: post.content,
          cover: post.cover,
          status: post.status,
          categoryId: post.categoryId,
          scheduledAt: post.scheduledAt,
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
      if (["scheduled", "unpublish_scheduled"].includes(input.status) && !input.scheduled_at) {
        throw errors.badRequest("计划状态必须设置执行时间");
      }
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
          publishedAt: ["published", "unpublish_scheduled"].includes(input.status) ? new Date() : null,
          scheduledAt: input.scheduled_at ? new Date(input.scheduled_at) : null,
        })
        .returning({ id: post.id });
      if (!row) throw errors.internal("保存文章失败");

      const categoryDeltas = new Map<number, number>();
      const tagDeltas = new Map<number, number>();
      if (["published", "unpublish_scheduled"].includes(input.status)) {
        if (input.category_id != null) categoryDeltas.set(input.category_id, 1);
        for (const tagId of await syncTags(row.id, input.tags)) {
          tagDeltas.set(tagId, 1);
        }
      } else {
        await syncTags(row.id, input.tags);
      }
      await applyTaxonomyCountDeltas(categoryDeltas, tagDeltas);
      await recordRevision(row.id);
      return loadDetailById(row.id);
    },

    async update(id: number, input: UpdatePostInput): Promise<PostDetail> {
      const [existing] = await db
        .select({
          id: post.id,
          content: post.content,
          status: post.status,
          publishedAt: post.publishedAt,
          scheduledAt: post.scheduledAt,
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
      if (input.scheduled_at !== undefined) {
        values.scheduledAt = input.scheduled_at ? new Date(input.scheduled_at) : null;
      }
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
      const requiresSchedule = nextStatus === "scheduled" || nextStatus === "unpublish_scheduled";
      const effectiveSchedule = input.scheduled_at === undefined
        ? existing.scheduledAt
        : input.scheduled_at ? new Date(input.scheduled_at) : null;
      if (requiresSchedule && !effectiveSchedule) {
        throw errors.badRequest("计划状态必须设置执行时间");
      }
      if (input.scheduled_at === undefined && !requiresSchedule) values.scheduledAt = null;
      if (nextStatus === "published" && !existing.publishedAt) {
        values.publishedAt = new Date();
      }

      await recordRevision(id);
      const [row] = await db
        .update(post)
        .set(values)
        .where(eq(post.id, id))
        .returning({ id: post.id });
      if (!row) throw errors.notFound("文章不存在");

      const wasPublished = ["published", "unpublish_scheduled"].includes(existing.status ?? "");
      const willBePublished = ["published", "unpublish_scheduled"].includes(nextStatus);
      const nextCategoryId =
        input.category_id === undefined ? existing.categoryId : input.category_id;
      const oldTagIds =
        input.tags !== undefined || wasPublished !== willBePublished
          ? await tagIdsForPost(id)
          : [];
      const newTagIds =
        input.tags === undefined ? oldTagIds : await syncTags(id, input.tags);
      const categoryDeltas = new Map<number, number>();
      if (
        wasPublished &&
        (!willBePublished || existing.categoryId !== nextCategoryId) &&
        existing.categoryId !== null
      ) {
        categoryDeltas.set(existing.categoryId, -1);
      }
      if (
        willBePublished &&
        (!wasPublished || existing.categoryId !== nextCategoryId) &&
        nextCategoryId !== null
      ) {
        categoryDeltas.set(nextCategoryId, (categoryDeltas.get(nextCategoryId) ?? 0) + 1);
      }
      const oldTagSet = new Set(oldTagIds);
      const newTagSet = new Set(newTagIds);
      const tagDeltas = new Map<number, number>();
      if (wasPublished) {
        for (const tagId of oldTagSet) {
          if (!willBePublished || !newTagSet.has(tagId)) tagDeltas.set(tagId, -1);
        }
      }
      if (willBePublished) {
        for (const tagId of newTagSet) {
          if (!wasPublished || !oldTagSet.has(tagId)) {
            tagDeltas.set(tagId, (tagDeltas.get(tagId) ?? 0) + 1);
          }
        }
      }
      await applyTaxonomyCountDeltas(categoryDeltas, tagDeltas);
      await db.delete(postDraft).where(eq(postDraft.postId, id));
      await recordRevision(id);
      return loadDetailById(id);
    },

    async saveDraft(id: number | null, snapshot: PostSnapshot): Promise<{ post_id: number }> {
      let postId = id;
      if (postId === null) {
        const created = await this.create({ ...snapshot, status: "draft", scheduled_at: undefined });
        postId = created.id;
      } else {
        await loadDetailById(postId);
      }
      await db.insert(postDraft).values({ postId, snapshot })
        .onConflictDoUpdate({
          target: postDraft.postId,
          set: { snapshot, updatedAt: new Date() },
        });
      const [latest] = await db.select({ snapshot: postRevision.snapshot, createdAt: postRevision.createdAt })
        .from(postRevision).where(eq(postRevision.postId, postId))
        .orderBy(desc(postRevision.createdAt), desc(postRevision.id)).limit(1);
      const changed = !latest || JSON.stringify(latest.snapshot) !== JSON.stringify(snapshot);
      const intervalElapsed = !latest || !latest.createdAt || Date.now() - latest.createdAt.getTime() >= 60_000;
      if (changed && intervalElapsed) {
        await db.insert(postRevision).values({ postId, snapshot });
      }
      return { post_id: postId };
    },

    async getDraft(id: number): Promise<PostSnapshot | null> {
      await loadDetailById(id);
      const [row] = await db.select({ snapshot: postDraft.snapshot })
        .from(postDraft).where(eq(postDraft.postId, id)).limit(1);
      return row ? row.snapshot as PostSnapshot : null;
    },

    async listRevisions(id: number) {
      await loadDetailById(id);
      const rows = await db.select({ id: postRevision.id, createdAt: postRevision.createdAt, snapshot: postRevision.snapshot })
        .from(postRevision).where(eq(postRevision.postId, id))
        .orderBy(desc(postRevision.createdAt), desc(postRevision.id));
      return rows.map((row) => ({
        id: row.id, created_at: iso(row.createdAt), snapshot: row.snapshot as PostSnapshot,
      }));
    },

    async restoreRevision(id: number, revisionId: number): Promise<PostSnapshot> {
      const [revision] = await db.select({ snapshot: postRevision.snapshot })
        .from(postRevision)
        .where(and(eq(postRevision.id, revisionId), eq(postRevision.postId, id)))
        .limit(1);
      if (!revision) throw errors.notFound("版本不存在");
      const snapshot = revision.snapshot as PostSnapshot;
      await this.saveDraft(id, snapshot);
      return snapshot;
    },

    async runDuePostSchedules(now = new Date()): Promise<number> {
      const due = await db.select({ id: post.id, status: post.status })
        .from(post)
        .where(and(
          inArray(post.status, ["scheduled", "unpublish_scheduled"]),
          sql`${post.scheduledAt} IS NOT NULL AND ${post.scheduledAt} <= ${now.getTime()}`,
        ));
      let changed = 0;
      for (const row of due) {
        await this.update(row.id, { status: row.status === "scheduled" ? "published" : "archived" });
        changed += 1;
      }
      return changed;
    },

    async remove(id: number): Promise<{ ok: true }> {
      const [existing] = await db
        .select({ categoryId: post.categoryId, status: post.status })
        .from(post)
        .where(eq(post.id, id))
        .limit(1);
      if (!existing) throw errors.notFound("文章不存在");
      const tagIds = await tagIdsForPost(id);
      const [row] = await db
        .delete(post)
        .where(eq(post.id, id))
        .returning({ id: post.id });
      if (!row) throw errors.notFound("文章不存在");

      const categoryDeltas = new Map<number, number>();
      const tagDeltas = new Map<number, number>();
      if (["published", "unpublish_scheduled"].includes(existing.status ?? "")) {
        if (existing.categoryId !== null) categoryDeltas.set(existing.categoryId, -1);
        for (const tagId of tagIds) tagDeltas.set(tagId, -1);
      }
      await applyTaxonomyCountDeltas(categoryDeltas, tagDeltas);
      return { ok: true };
    },

    async listAllPublished(): Promise<
      Array<{ slug: string; updated_at: string }>
    > {
      const rows = await db
        .select({ slug: post.slug, updatedAt: post.updatedAt })
        .from(post)
        .where(inArray(post.status, ["published", "unpublish_scheduled"]))
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

      const [row] = status === "published"
        ? await query.where(inArray(post.status, ["published", "unpublish_scheduled"]))
        : status ? await query.where(eq(post.status, status)) : await query;
      return row?.value ?? 0;
    },

    async like(
      id: number,
      unlike = false,
      visitorKey?: string,
    ): Promise<{ likes: number }> {
      const where = and(eq(post.id, id), inArray(post.status, ["published", "unpublish_scheduled"]));

      // 同一个人重复点等于没点：先过记账表，只有真的新增/撤销才动计数器。
      const changed = await applyLike(db, {
        targetType: "post",
        targetId: id,
        visitorKey,
        unlike,
      });
      if (!changed) {
        const [row] = await db
          .select({ likes: post.likes })
          .from(post)
          .where(where)
          .limit(1);
        if (!row) throw errors.notFound("文章不存在");
        return { likes: row.likes ?? 0 };
      }

      const delta = unlike ? -1 : 1;
      const [row] = await db
        .update(post)
        .set({
          likes: sql<number>`max(0, coalesce(${post.likes}, 0) + ${delta})`,
        })
        .where(where)
        .returning({ likes: post.likes });

      if (!row) throw errors.notFound("文章不存在");
      return { likes: row.likes ?? 0 };
    },

    /**
     * Atomic view increment. Called only from the client-side reporting route;
     * reading an article (including SSR prefetch) must never call this.
     */
    async incrementView(
      id: number,
      visitorKey: string,
      day: string,
    ): Promise<{ counted: true; views: number } | { counted: false }> {
      return db.transaction((tx) => {
        const article = tx
          .select({ id: post.id })
          .from(post)
          .where(and(eq(post.id, id), inArray(post.status, ["published", "unpublish_scheduled"])))
          .limit(1)
          .get();
        if (!article) throw errors.notFound("文章不存在");

        const inserted = tx
          .insert(postView)
          .values({ postId: id, visitorKey, day })
          .onConflictDoNothing()
          .returning({ id: postView.id })
          .get();
        if (!inserted) return { counted: false };

        const updated = tx
          .update(post)
          .set({ views: sql<number>`coalesce(${post.views}, 0) + 1` })
          .where(and(eq(post.id, id), inArray(post.status, ["published", "unpublish_scheduled"])))
          .returning({ views: post.views })
          .get();
        if (!updated) throw errors.notFound("文章不存在");
        return { counted: true, views: updated.views ?? 0 };
      });
    },
  };
}

export type PostsService = ReturnType<typeof createPostsService>;
