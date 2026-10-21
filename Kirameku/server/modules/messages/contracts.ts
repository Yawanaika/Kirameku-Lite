import { z } from "zod";

/** Public message list query. Only approved top-level messages are exposed. */
export const messageListQuery = z.object({
  status: z.literal("approved").default("approved"),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export const messageCountQuery = z.object({
  status: z.literal("approved").default("approved"),
});

const optionalParentId = z
  .union([z.coerce.number().int().min(1), z.null()])
  .optional()
  .transform((value) => value ?? undefined);

export const createMessageInput = z.object({
  parent_id: optionalParentId,
  content: z.string().trim().min(1).max(5000),
});

export const messageIdParams = z.object({
  messageId: z.coerce.number().int().min(1),
});

/** Internal service input; the public route narrows status to approved. */
export interface MessageListParams {
  page: number;
  size: number;
}

export interface MessageGitHubUser {
  id: number;
  login: string;
  avatar: string;
  bio: string;
}

export interface MessageItem {
  id: number;
  github_user_id: number | null;
  parent_id: number | null;
  content: string;
  ip: string;
  status: string;
  likes: number;
  created_at: string;
  github_user: MessageGitHubUser | null;
  replies: MessageItem[];
}
