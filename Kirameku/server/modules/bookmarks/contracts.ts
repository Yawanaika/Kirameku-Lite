import { z } from "zod";

const bookmarkName = z.string().trim().min(1).max(100);
const bookmarkUrl = z.string().trim().min(1).max(500);
const bookmarkIcon = z.string().trim().max(500);
const bookmarkDescription = z.string().trim().max(2000);
const bookmarkSort = z.coerce.number().int().min(0).max(1_000_000);
const bookmarkPlatforms = z
  .array(z.string().trim().min(1).max(50))
  .max(50);

export const createBookmarkCategoryInput = z.object({
  name: bookmarkName,
  icon: bookmarkIcon.default(""),
  description: bookmarkDescription.default(""),
  sort: bookmarkSort.default(0),
});

export const updateBookmarkCategoryInput = z
  .object({
    name: bookmarkName.optional(),
    icon: bookmarkIcon.optional(),
    description: bookmarkDescription.optional(),
    sort: bookmarkSort.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个字段",
  });

export const bookmarkCategoryIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

export const createBookmarkSiteInput = z.object({
  category_id: z.coerce.number().int().min(1),
  name: bookmarkName,
  url: bookmarkUrl,
  icon: bookmarkIcon.default(""),
  description: bookmarkDescription.default(""),
  platforms: bookmarkPlatforms.default([]),
  sort: bookmarkSort.default(0),
});

export const updateBookmarkSiteInput = z
  .object({
    category_id: z.coerce.number().int().min(1).optional(),
    name: bookmarkName.optional(),
    url: bookmarkUrl.optional(),
    icon: bookmarkIcon.optional(),
    description: bookmarkDescription.optional(),
    platforms: bookmarkPlatforms.optional(),
    sort: bookmarkSort.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个字段",
  });

export const bookmarkSiteIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

export const bookmarkSiteListQuery = z.object({
  category_id: z.coerce.number().int().min(1).optional(),
});

export type CreateBookmarkCategoryInput = z.infer<
  typeof createBookmarkCategoryInput
>;
export type UpdateBookmarkCategoryInput = z.infer<
  typeof updateBookmarkCategoryInput
>;
export type CreateBookmarkSiteInput = z.infer<typeof createBookmarkSiteInput>;
export type UpdateBookmarkSiteInput = z.infer<typeof updateBookmarkSiteInput>;

export interface BookmarkSiteItem {
  id: number;
  category_id: number;
  name: string;
  url: string;
  icon: string;
  description: string;
  platforms: string[];
  sort: number;
  created_at: string;
  updated_at: string | null;
}

export interface BookmarkCategoryItem {
  id: number;
  name: string;
  icon: string;
  description: string;
  sort: number;
  created_at: string;
  updated_at: string | null;
  sites: BookmarkSiteItem[];
}
