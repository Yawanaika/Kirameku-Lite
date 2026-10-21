import { asc } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { bookmarkCategory, bookmarkSite } from "@/server/db/schema";
import type { BookmarkCategoryItem, BookmarkSiteItem } from "./contracts";

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
  };
}

export type BookmarksService = ReturnType<typeof createBookmarksService>;
