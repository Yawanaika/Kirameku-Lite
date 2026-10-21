import { and, asc, count, eq, ne, or } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { category, post } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type { CategoryItem } from "@/server/modules/posts/contracts";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./contracts";

function toItem(row: {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sort: number | null;
  postCount: number;
}): CategoryItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    sort: row.sort ?? 0,
    post_count: row.postCount,
  };
}

export function createCategoriesService(db: AppDatabase) {
  async function loadById(id: number): Promise<CategoryItem> {
    const [row] = await db
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
      .where(eq(category.id, id))
      .groupBy(category.id)
      .limit(1);

    if (!row) throw errors.notFound("分类不存在");
    return toItem(row);
  }

  async function assertUnique(
    name: string | undefined,
    slug: string | undefined,
    excludeId?: number,
  ): Promise<void> {
    const conditions = [
      ...(name ? [eq(category.name, name)] : []),
      ...(slug ? [eq(category.slug, slug)] : []),
    ];
    if (conditions.length === 0) return;

    const where = excludeId
      ? and(or(...conditions), ne(category.id, excludeId))
      : or(...conditions);
    const [row] = await db
      .select({ id: category.id })
      .from(category)
      .where(where)
      .limit(1);
    if (row) throw errors.conflict("分类名称或 slug 已存在");
  }

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

      return rows.map(toItem);
    },

    async create(input: CreateCategoryInput): Promise<CategoryItem> {
      await assertUnique(input.name, input.slug);
      const [row] = await db
        .insert(category)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description,
          sort: input.sort,
        })
        .returning({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          sort: category.sort,
        });
      if (!row) throw errors.internal("保存分类失败");
      return toItem({ ...row, postCount: 0 });
    },

    async update(
      id: number,
      input: UpdateCategoryInput,
    ): Promise<CategoryItem> {
      await assertUnique(input.name, input.slug, id);

      const values: Partial<typeof category.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) values.name = input.name;
      if (input.slug !== undefined) values.slug = input.slug;
      if (input.description !== undefined) {
        values.description = input.description;
      }
      if (input.sort !== undefined) values.sort = input.sort;

      const [row] = await db
        .update(category)
        .set(values)
        .where(eq(category.id, id))
        .returning({ id: category.id });
      if (!row) throw errors.notFound("分类不存在");
      return loadById(id);
    },

    async remove(id: number): Promise<{ ok: true }> {
      const [row] = await db
        .delete(category)
        .where(eq(category.id, id))
        .returning({ id: category.id });
      if (!row) throw errors.notFound("分类不存在");
      return { ok: true };
    },
  };
}

export type CategoriesService = ReturnType<typeof createCategoriesService>;
