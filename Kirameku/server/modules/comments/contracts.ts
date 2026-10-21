import { z } from "zod";

export const postCommentsParams = z.object({
  postId: z.coerce.number().int().min(1),
});

export const chatterCommentsParams = z.object({
  chatterId: z.coerce.number().int().min(1),
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
