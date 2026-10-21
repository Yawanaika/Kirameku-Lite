import { asc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { bookmarkCategory, bookmarkSite } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type {
  BookmarkCategoryItem,
  BookmarkSiteItem,
  CreateBookmarkCategoryInput,
  CreateBookmarkSiteInput,
  UpdateBookmarkCategoryInput,
  UpdateBookmarkSiteInput,
} from "./contracts";

type CategoryRow = Pick<
  typeof bookmarkCategory.$inferSelect,
  "id" | "name" | "icon" | "description" | "sort" | "createdAt" | "updatedAt"
>;

type SiteRow = Pick<
  typeof bookmarkSite.$inferSelect,
  | "id"
  | "categoryId"
  | "name"
  | "url"
  | "icon"
  | "description"
  | "platforms"
  | "sort"
  | "createdAt"
  | "updatedAt"
>;

function iso(value: Date | null): string {
  return (value ?? new Date(0)).toISOString();
}

function parsePlatforms(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function toSite(row: SiteRow): BookmarkSiteItem {
  return {
    id: row.id,
    category_id: row.categoryId,
    name: row.name,
    url: row.url,
    icon: row.icon ?? "",
    description: row.description ?? "",
    platforms: parsePlatforms(row.platforms),
    sort: row.sort ?? 0,
    created_at: iso(row.createdAt),
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

function toCategory(
  row: CategoryRow,
  sites: BookmarkSiteItem[],
): BookmarkCategoryItem {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? "",
    description: row.description ?? "",
    sort: row.sort ?? 0,
    created_at: iso(row.createdAt),
    updated_at: row.updatedAt?.toISOString() ?? null,
    sites,
  };
}

export function createBookmarksService(db: AppDatabase) {
  async function ensureCategory(id: number): Promise<void> {
    const [row] = await db
      .select({ id: bookmarkCategory.id })
      .from(bookmarkCategory)
      .where(eq(bookmarkCategory.id, id))
      .limit(1);
    if (!row) throw errors.notFound("分类不存在");
  }

  return {
    async list(): Promise<BookmarkCategoryItem[]> {
      const [categories, sites] = await Promise.all([
        db
          .select({
            id: bookmarkCategory.id,
            name: bookmarkCategory.name,
            icon: bookmarkCategory.icon,
            description: bookmarkCategory.description,
            sort: bookmarkCategory.sort,
            createdAt: bookmarkCategory.createdAt,
            updatedAt: bookmarkCategory.updatedAt,
          })
          .from(bookmarkCategory)
          .orderBy(asc(bookmarkCategory.sort), asc(bookmarkCategory.id)),
        db
          .select({
            id: bookmarkSite.id,
            categoryId: bookmarkSite.categoryId,
            name: bookmarkSite.name,
            url: bookmarkSite.url,
            icon: bookmarkSite.icon,
            description: bookmarkSite.description,
            platforms: bookmarkSite.platforms,
            sort: bookmarkSite.sort,
            createdAt: bookmarkSite.createdAt,
            updatedAt: bookmarkSite.updatedAt,
          })
          .from(bookmarkSite)
          .orderBy(asc(bookmarkSite.sort), asc(bookmarkSite.id)),
      ]);

      const sitesByCategory = new Map<number, BookmarkSiteItem[]>();
      for (const row of sites) {
        const item = toSite(row);
        const group = sitesByCategory.get(row.categoryId) ?? [];
        group.push(item);
        sitesByCategory.set(row.categoryId, group);
      }

      return categories.map((row) =>
        toCategory(row, sitesByCategory.get(row.id) ?? []),
      );
    },

    async listCategories(): Promise<BookmarkCategoryItem[]> {
      const rows = await db
        .select({
          id: bookmarkCategory.id,
          name: bookmarkCategory.name,
          icon: bookmarkCategory.icon,
          description: bookmarkCategory.description,
          sort: bookmarkCategory.sort,
          createdAt: bookmarkCategory.createdAt,
          updatedAt: bookmarkCategory.updatedAt,
        })
        .from(bookmarkCategory)
        .orderBy(asc(bookmarkCategory.sort), asc(bookmarkCategory.id));

      return rows.map((row) => toCategory(row, []));
    },

    async listSites(categoryId?: number): Promise<BookmarkSiteItem[]> {
      const query = db
        .select({
          id: bookmarkSite.id,
          categoryId: bookmarkSite.categoryId,
          name: bookmarkSite.name,
          url: bookmarkSite.url,
          icon: bookmarkSite.icon,
          description: bookmarkSite.description,
          platforms: bookmarkSite.platforms,
          sort: bookmarkSite.sort,
          createdAt: bookmarkSite.createdAt,
          updatedAt: bookmarkSite.updatedAt,
        })
        .from(bookmarkSite);

      const rows = categoryId
        ? await query
            .where(eq(bookmarkSite.categoryId, categoryId))
            .orderBy(asc(bookmarkSite.sort), asc(bookmarkSite.id))
        : await query.orderBy(asc(bookmarkSite.sort), asc(bookmarkSite.id));

      return rows.map(toSite);
    },

    async createCategory(
      input: CreateBookmarkCategoryInput,
    ): Promise<BookmarkCategoryItem> {
      const [row] = await db
        .insert(bookmarkCategory)
        .values({
          name: input.name,
          icon: input.icon,
          description: input.description,
          sort: input.sort,
        })
        .returning();
      if (!row) throw errors.internal("保存收藏夹分类失败");
      return toCategory(row, []);
    },

    async updateCategory(
      id: number,
      input: UpdateBookmarkCategoryInput,
    ): Promise<BookmarkCategoryItem> {
      const values: Partial<typeof bookmarkCategory.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) values.name = input.name;
      if (input.icon !== undefined) values.icon = input.icon;
      if (input.description !== undefined) {
        values.description = input.description;
      }
      if (input.sort !== undefined) values.sort = input.sort;

      const [row] = await db
        .update(bookmarkCategory)
        .set(values)
        .where(eq(bookmarkCategory.id, id))
        .returning();
      if (!row) throw errors.notFound("分类不存在");
      return toCategory(row, []);
    },

    async removeCategory(id: number): Promise<{ ok: true }> {
      const [row] = await db
        .delete(bookmarkCategory)
        .where(eq(bookmarkCategory.id, id))
        .returning({ id: bookmarkCategory.id });
      if (!row) throw errors.notFound("分类不存在");
      return { ok: true };
    },

    async createSite(
      input: CreateBookmarkSiteInput,
    ): Promise<BookmarkSiteItem> {
      await ensureCategory(input.category_id);

      const [row] = await db
        .insert(bookmarkSite)
        .values({
          categoryId: input.category_id,
          name: input.name,
          url: input.url,
          icon: input.icon,
          description: input.description,
          platforms: JSON.stringify(input.platforms),
          sort: input.sort,
        })
        .returning();
      if (!row) throw errors.internal("保存收藏站点失败");
      return toSite(row);
    },

    async updateSite(
      id: number,
      input: UpdateBookmarkSiteInput,
    ): Promise<BookmarkSiteItem> {
      if (input.category_id !== undefined) {
        await ensureCategory(input.category_id);
      }

      const values: Partial<typeof bookmarkSite.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.category_id !== undefined) {
        values.categoryId = input.category_id;
      }
      if (input.name !== undefined) values.name = input.name;
      if (input.url !== undefined) values.url = input.url;
      if (input.icon !== undefined) values.icon = input.icon;
      if (input.description !== undefined) {
        values.description = input.description;
      }
      if (input.platforms !== undefined) {
        values.platforms = JSON.stringify(input.platforms);
      }
      if (input.sort !== undefined) values.sort = input.sort;

      const [row] = await db
        .update(bookmarkSite)
        .set(values)
        .where(eq(bookmarkSite.id, id))
        .returning();
      if (!row) throw errors.notFound("站点不存在");
      return toSite(row);
    },

    async removeSite(id: number): Promise<{ ok: true }> {
      const [row] = await db
        .delete(bookmarkSite)
        .where(eq(bookmarkSite.id, id))
        .returning({ id: bookmarkSite.id });
      if (!row) throw errors.notFound("站点不存在");
      return { ok: true };
    },
  };
}

export type BookmarksService = ReturnType<typeof createBookmarksService>;
