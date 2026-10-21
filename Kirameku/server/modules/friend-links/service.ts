import { asc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { friendLink } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type {
  CreateFriendLinkInput,
  FriendLinkItem,
  UpdateFriendLinkInput,
} from "./contracts";

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

    async listAll(): Promise<FriendLinkItem[]> {
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
        .orderBy(asc(friendLink.sort), asc(friendLink.id));

      return rows.map(toItem);
    },

    async create(input: CreateFriendLinkInput): Promise<FriendLinkItem> {
      const [row] = await db
        .insert(friendLink)
        .values({
          name: input.name,
          url: input.url,
          avatar: input.avatar,
          description: input.description,
          sort: input.sort,
          isApproved: input.is_approved,
        })
        .returning();
      if (!row) throw errors.internal("保存友链失败");
      return toItem(row);
    },

    async update(
      id: number,
      input: UpdateFriendLinkInput,
    ): Promise<FriendLinkItem> {
      const values: Partial<typeof friendLink.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) values.name = input.name;
      if (input.url !== undefined) values.url = input.url;
      if (input.avatar !== undefined) values.avatar = input.avatar;
      if (input.description !== undefined) {
        values.description = input.description;
      }
      if (input.sort !== undefined) values.sort = input.sort;
      if (input.is_approved !== undefined) {
        values.isApproved = input.is_approved;
      }

      const [row] = await db
        .update(friendLink)
        .set(values)
        .where(eq(friendLink.id, id))
        .returning();
      if (!row) throw errors.notFound("友链不存在");
      return toItem(row);
    },

    async remove(id: number): Promise<{ ok: true }> {
      const [row] = await db
        .delete(friendLink)
        .where(eq(friendLink.id, id))
        .returning({ id: friendLink.id });
      if (!row) throw errors.notFound("友链不存在");
      return { ok: true };
    },
  };
}

export type FriendLinksService = ReturnType<typeof createFriendLinksService>;
