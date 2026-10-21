import { and, asc, count, desc, eq, ne, or } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { post, postTag, tag } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type { TagItem } from "@/server/modules/posts/contracts";
import type { CreateTagInput, UpdateTagInput } from "./contracts";

function toItem(row: {
  id: number;
  name: string;
  slug: string;
  postCount: number;
}): TagItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    post_count: row.postCount,
  };
}

export function createTagsService(db: AppDatabase) {
  async function loadById(id: number): Promise<TagItem> {
    const [row] = await db
      .select({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        postCount: count(post.id),
      })
      .from(tag)
      .leftJoin(postTag, eq(postTag.tagId, tag.id))
      .leftJoin(
        post,
        and(eq(post.id, postTag.postId), eq(post.status, "published")),
      )
      .where(eq(tag.id, id))
      .groupBy(tag.id)
      .limit(1);

    if (!row) throw errors.notFound("标签不存在");
    return toItem(row);
  }

  async function assertUnique(
    name: string | undefined,
    slug: string | undefined,
    excludeId?: number,
  ): Promise<void> {
    const conditions = [
      ...(name ? [eq(tag.name, name)] : []),
      ...(slug ? [eq(tag.slug, slug)] : []),
    ];
    if (conditions.length === 0) return;

    const where = excludeId
      ? and(or(...conditions), ne(tag.id, excludeId))
      : or(...conditions);
    const [row] = await db
      .select({ id: tag.id })
      .from(tag)
      .where(where)
      .limit(1);
    if (row) throw errors.conflict("标签名称或 slug 已存在");
  }

  return {
    async list(): Promise<TagItem[]> {
      const rows = await db
        .select({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          postCount: count(post.id),
        })
        .from(tag)
        .leftJoin(postTag, eq(postTag.tagId, tag.id))
        .leftJoin(
          post,
          and(eq(post.id, postTag.postId), eq(post.status, "published")),
        )
        .groupBy(tag.id)
        .orderBy(desc(count(post.id)), asc(tag.name));

      return rows.map(toItem);
    },

    async create(input: CreateTagInput): Promise<TagItem> {
      await assertUnique(input.name, input.slug);
      const [row] = await db
        .insert(tag)
        .values({ name: input.name, slug: input.slug })
        .returning({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
        });
      if (!row) throw errors.internal("保存标签失败");
      return toItem({ ...row, postCount: 0 });
    },

    async update(id: number, input: UpdateTagInput): Promise<TagItem> {
      await assertUnique(input.name, input.slug, id);

      const values: Partial<typeof tag.$inferInsert> = {};
      if (input.name !== undefined) values.name = input.name;
      if (input.slug !== undefined) values.slug = input.slug;

      const [row] = await db
        .update(tag)
        .set(values)
        .where(eq(tag.id, id))
        .returning({ id: tag.id });
      if (!row) throw errors.notFound("标签不存在");
      return loadById(id);
    },

    async remove(id: number): Promise<{ ok: true }> {
      const [row] = await db
        .delete(tag)
        .where(eq(tag.id, id))
        .returning({ id: tag.id });
      if (!row) throw errors.notFound("标签不存在");
      return { ok: true };
    },
  };
}

export type TagsService = ReturnType<typeof createTagsService>;
