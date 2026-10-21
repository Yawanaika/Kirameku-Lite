import { z } from "zod";

/** Public chatter list query. Drafts are never exposed by the public API. */
export const chatterListQuery = z.object({
  status: z.literal("published").default("published"),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(20),
});

export const chatterCountQuery = z.object({
  status: z.literal("published").default("published"),
});

export const chatterParams = z.object({
  chatterId: z.coerce.number().int().min(1),
});

export const adminChatterListQuery = z.object({
  status: z.string().trim().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(20),
});

export const adminChatterCountQuery = z.object({
  status: z.string().trim().min(1).max(50).optional(),
});

export const adminChatterIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

const chatterContent = z.string().trim().min(1).max(10_000);
const chatterImages = z.array(z.string().trim().max(1000)).max(20);
const chatterMood = z.string().trim().max(100);
const chatterStatus = z.string().trim().min(1).max(50);

export const createChatterInput = z.object({
  content: chatterContent,
  images: chatterImages.default([]),
  mood: chatterMood.default(""),
  status: chatterStatus.default("draft"),
});

export const updateChatterInput = z
  .object({
    content: chatterContent.optional(),
    images: chatterImages.optional(),
    mood: chatterMood.optional(),
    status: chatterStatus.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个字段",
  });

export type CreateChatterInput = z.infer<typeof createChatterInput>;
export type UpdateChatterInput = z.infer<typeof updateChatterInput>;

/** Internal service input; the public route narrows status to published. */
export interface ChatterListParams {
  status?: string;
  page: number;
  size: number;
}

export interface ChatterItem {
  id: number;
  content: string;
  images: string[];
  mood: string;
  likes: number;
  comments_count: number;
  status: string;
  created_at: string;
  updated_at: string | null;
}
