import { z } from "zod";

const categoryName = z.string().trim().min(1).max(100);
const categorySlug = z.string().trim().min(1).max(100);
const categoryDescription = z.string().trim().max(2000);
const categorySort = z.coerce.number().int().min(0).max(1_000_000);

export const createCategoryInput = z.object({
  name: categoryName,
  slug: categorySlug,
  description: categoryDescription.default(""),
  sort: categorySort.default(0),
});

export const updateCategoryInput = z
  .object({
    name: categoryName.optional(),
    slug: categorySlug.optional(),
    description: categoryDescription.optional(),
    sort: categorySort.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个字段",
  });

export const categoryIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

export type CreateCategoryInput = z.infer<typeof createCategoryInput>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryInput>;
