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

export const adminPostListQuery = z.object({
  status: z.string().trim().min(1).max(50).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  tag: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(20),
});

export const adminPostCountQuery = z.object({
  status: z.string().trim().min(1).max(50).optional(),
});

export const postIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

const postTitle = z.string().trim().min(1).max(200);
const postSlug = z.string().trim().min(1).max(200);
const postDescription = z.string().trim().max(5000);
const postContent = z.string().max(2_000_000);
const postCover = z.string().trim().max(1000);
const postStatus = z.string().trim().min(1).max(50);
const postCategoryId = z.coerce.number().int().min(1).nullable();
const postTags = z.array(z.string().trim().max(100)).max(50);
const postWordCount = z.coerce.number().int().min(0).max(10_000_000);
const postReadingTime = z.coerce.number().int().min(0).max(1_000_000);

export const createPostInput = z.object({
  title: postTitle,
  slug: postSlug,
  description: postDescription.default(""),
  content: postContent.default(""),
  cover: postCover.default(""),
  category_id: postCategoryId.optional(),
  tags: postTags.default([]),
  status: postStatus.default("draft"),
  is_pinned: z.boolean().default(false),
  word_count: postWordCount.optional(),
  reading_time: postReadingTime.optional(),
});

export const updatePostInput = z
  .object({
    title: postTitle.optional(),
    slug: postSlug.optional(),
    description: postDescription.optional(),
    content: postContent.optional(),
    cover: postCover.optional(),
    category_id: postCategoryId.optional(),
    tags: postTags.optional(),
    status: postStatus.optional(),
    is_pinned: z.boolean().optional(),
    word_count: postWordCount.optional(),
    reading_time: postReadingTime.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个字段",
  });

export type AdminPostListQuery = z.infer<typeof adminPostListQuery>;
export type CreatePostInput = z.infer<typeof createPostInput>;
export type UpdatePostInput = z.infer<typeof updatePostInput>;

/** Internal service input; the public route narrows status to published. */
export interface PostListParams {
  status?: string;
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
