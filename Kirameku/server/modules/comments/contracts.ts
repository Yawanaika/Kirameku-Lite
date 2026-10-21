import { z } from "zod";

export const postCommentsParams = z.object({
  postId: z.coerce.number().int().min(1),
});

export const chatterCommentsParams = z.object({
  chatterId: z.coerce.number().int().min(1),
});

const optionalParentId = z
  .union([z.coerce.number().int().min(1), z.null()])
  .optional()
  .transform((value) => value ?? undefined);

export const createPostCommentInput = z.object({
  post_id: z.coerce.number().int().min(1),
  parent_id: optionalParentId,
  content: z.string().trim().min(1).max(5000),
});

export const createChatterCommentInput = z.object({
  chatter_id: z.coerce.number().int().min(1),
  parent_id: optionalParentId,
  content: z.string().trim().min(1).max(5000),
});

export const commentIdParams = z.object({
  commentId: z.coerce.number().int().min(1),
});

export interface CommentGitHubUser {
  id: number;
  login: string;
  avatar: string;
  bio: string;
}

export interface PostCommentItem {
  id: number;
  post_id: number;
  parent_id: number | null;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  github_user: CommentGitHubUser | null;
  replies: PostCommentItem[];
}

export interface ChatterCommentItem {
  id: number;
  chatter_id: number;
  parent_id: number | null;
  content: string;
  likes: number;
  status: string;
  created_at: string;
  github_user: CommentGitHubUser | null;
  replies: ChatterCommentItem[];
}
