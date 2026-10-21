import { and, asc, count, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { category, post } from "@/server/db/schema";
import type { CategoryItem } from "@/server/modules/posts/contracts";

export function createCategoriesService(db: AppDatabase) {
  return {
    async list(): Promise<CategoryItem[]> {
      const rows = await db
        .select({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          sort: category.sort,
          postCount: count(post.id),
        })
        .from(category)
        .leftJoin(
          post,
          and(eq(post.categoryId, category.id), eq(post.status, "published")),
        )
        .groupBy(category.id)
        .orderBy(asc(category.sort), asc(category.id));

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description ?? "",
        sort: row.sort ?? 0,
        post_count: row.postCount,
      }));
    },
  };
}

export type CategoriesService = ReturnType<typeof createCategoriesService>;
