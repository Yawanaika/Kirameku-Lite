import { z } from "zod";

const tagName = z.string().trim().min(1).max(100);
const tagSlug = z.string().trim().min(1).max(100);

export const createTagInput = z.object({
  name: tagName,
  slug: tagSlug,
});

export const updateTagInput = z
  .object({
    name: tagName.optional(),
    slug: tagSlug.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个字段",
  });

export const tagIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

export type CreateTagInput = z.infer<typeof createTagInput>;
export type UpdateTagInput = z.infer<typeof updateTagInput>;
