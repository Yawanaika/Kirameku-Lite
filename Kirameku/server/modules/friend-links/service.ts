import { asc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { friendLink } from "@/server/db/schema";
import type { FriendLinkItem } from "./contracts";

type FriendLinkRow = Pick<
  typeof friendLink.$inferSelect,
  | "id"
  | "name"
  | "url"
  | "avatar"
  | "description"
  | "sort"
  | "isApproved"
  | "createdAt"
  | "updatedAt"
>;

function toItem(row: FriendLinkRow): FriendLinkItem {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    avatar: row.avatar ?? "",
    description: row.description ?? "",
    sort: row.sort ?? 0,
    is_approved: row.isApproved ?? false,
    created_at: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export function createFriendLinksService(db: AppDatabase) {
  return {
    async listApproved(): Promise<FriendLinkItem[]> {
      const rows = await db
        .select({
          id: friendLink.id,
          name: friendLink.name,
          url: friendLink.url,
          avatar: friendLink.avatar,
          description: friendLink.description,
          sort: friendLink.sort,
          isApproved: friendLink.isApproved,
          createdAt: friendLink.createdAt,
          updatedAt: friendLink.updatedAt,
        })
        .from(friendLink)
        .where(eq(friendLink.isApproved, true))
        .orderBy(asc(friendLink.sort), asc(friendLink.id));

      return rows.map(toItem);
    },
  };
}

export type FriendLinksService = ReturnType<typeof createFriendLinksService>;
