import { z } from "zod";

const friendLinkName = z.string().trim().min(1).max(100);
const friendLinkUrl = z.string().trim().min(1).max(500);
const friendLinkAvatar = z.string().trim().max(500);
const friendLinkDescription = z.string().trim().max(2000);
const friendLinkSort = z.coerce.number().int().min(0).max(1_000_000);

export const createFriendLinkInput = z.object({
  name: friendLinkName,
  url: friendLinkUrl,
  avatar: friendLinkAvatar.default(""),
  description: friendLinkDescription.default(""),
  sort: friendLinkSort.default(0),
  is_approved: z.boolean().default(false),
});

export const updateFriendLinkInput = z
  .object({
    name: friendLinkName.optional(),
    url: friendLinkUrl.optional(),
    avatar: friendLinkAvatar.optional(),
    description: friendLinkDescription.optional(),
    sort: friendLinkSort.optional(),
    is_approved: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个字段",
  });

export const friendLinkIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

export type CreateFriendLinkInput = z.infer<typeof createFriendLinkInput>;
export type UpdateFriendLinkInput = z.infer<typeof updateFriendLinkInput>;

export interface FriendLinkItem {
  id: number;
  name: string;
  url: string;
  avatar: string;
  description: string;
  sort: number;
  is_approved: boolean;
  created_at: string;
  updated_at: string | null;
}
