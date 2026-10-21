import { z } from "zod";

/** Public post list query. Drafts are never exposed by the public API. */
export const postListQuery = z.object({
  status: z.literal("published").default("published"),
  category: z.string().trim().min(1).max(100).optional(),
  tag: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(10),
});

export const postCountQuery = z.object({
  status: z.literal("published").default("published"),
});

/** Internal service input; the public route narrows status to published. */
export interface PostListParams {
  status: string;
  category?: string;
  tag?: string;
  page: number;
  size: number;
}

export interface PostItem {
  id: number;
  title: string;
  slug: string;
  description: string;
  cover: string;
  category: string;
  tags: string[];
  status: string;
  is_pinned: boolean;
  views: number;
  likes: number;
  word_count: number;
  reading_time: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostDetail extends PostItem {
  content: string;
}

export interface CategoryItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort: number;
  post_count: number;
}

export interface TagItem {
  id: number;
  name: string;
  slug: string;
  post_count: number;
}
