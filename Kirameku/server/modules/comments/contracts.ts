import { z } from "zod";

/**
 * 评论只有「已通过 / 已拒绝」两种状态：入库默认 approved，后台只能互转。
 * 以前还留着一个 pending 分支，但没有任何写路径会产出它，
 * 于是「待审核」筛选永远为空、仪表盘的待审核计数永远是 0。
 */
export const reviewStatus = z.enum(["approved", "rejected"]);
export type ReviewStatus = z.infer<typeof reviewStatus>;

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

export const adminCommentListQuery = z.object({
  status: reviewStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminCommentIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

export const updateCommentStatusInput = z.object({
  status: reviewStatus,
});

export const adminChatterCommentListQuery = z.object({
  status: reviewStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminChatterCommentIdParams = z.object({
  id: z.coerce.number().int().min(1),
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

export type AdminPostCommentItem = Omit<PostCommentItem, "replies"> & {
  ip: string;
  replies: AdminPostCommentItem[];
};

export type AdminChatterCommentItem = Omit<ChatterCommentItem, "replies"> & {
  ip: string;
  replies: AdminChatterCommentItem[];
};
