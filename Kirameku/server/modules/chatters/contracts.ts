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

/** Internal service input; the public route narrows status to published. */
export interface ChatterListParams {
  status: string;
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
