import { and, asc, count, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { post, postTag, tag } from "@/server/db/schema";
import type { TagItem } from "@/server/modules/posts/contracts";

export function createTagsService(db: AppDatabase) {
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

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        post_count: row.postCount,
      }));
    },
  };
}

export type TagsService = ReturnType<typeof createTagsService>;
