import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { githubUser, message } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type {
  MessageItem,
  MessageListParams,
} from "./contracts";

interface MessageRow {
  id: number;
  githubUserId: number | null;
  parentId: number | null;
  content: string;
  ip: string | null;
  status: string | null;
  likes: number | null;
  createdAt: Date | null;
  ghId: number | null;
  ghLogin: string | null;
  ghAvatar: string | null;
  ghBio: string | null;
}

function toItem(
  row: MessageRow,
  childrenByParent: Map<number, MessageRow[]>,
): MessageItem {
  return {
    id: row.id,
    github_user_id: row.githubUserId,
    parent_id: row.parentId,
    content: row.content,
    ip: row.ip ?? "",
    status: row.status ?? "approved",
    likes: row.likes ?? 0,
    created_at: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    github_user:
      row.ghId === null
        ? null
        : {
            id: row.ghId,
            login: row.ghLogin ?? "",
            avatar: row.ghAvatar ?? "",
            bio: row.ghBio ?? "",
          },
    replies: (childrenByParent.get(row.id) ?? []).map((child) =>
      toItem(child, childrenByParent),
    ),
  };
}

function sortReplies(rows: MessageRow[]): MessageRow[] {
  return rows.sort((a, b) => {
    const timeDiff =
      (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
    return timeDiff !== 0 ? timeDiff : a.id - b.id;
  });
}

function groupChildren(rows: MessageRow[]): Map<number, MessageRow[]> {
  const childrenByParent = new Map<number, MessageRow[]>();
  for (const row of rows) {
    if (row.parentId === null) continue;
    const siblings = childrenByParent.get(row.parentId) ?? [];
    siblings.push(row);
    childrenByParent.set(row.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    sortReplies(siblings);
  }
  return childrenByParent;
}

export function createMessagesService(db: AppDatabase) {
  async function loadApprovedRows(): Promise<MessageRow[]> {
    return db
      .select({
        id: message.id,
        githubUserId: message.githubUserId,
        parentId: message.parentId,
        content: message.content,
        ip: message.ip,
        status: message.status,
        likes: message.likes,
        createdAt: message.createdAt,
        ghId: githubUser.id,
        ghLogin: githubUser.login,
        ghAvatar: githubUser.avatar,
        ghBio: githubUser.bio,
      })
      .from(message)
      .leftJoin(githubUser, eq(message.githubUserId, githubUser.id))
      .where(eq(message.status, "approved"))
      .orderBy(desc(message.createdAt), desc(message.id));
  }

  async function getApprovedById(id: number): Promise<MessageItem> {
    const rows = await loadApprovedRows();
    const row = rows.find((item) => item.id === id);
    if (!row) throw errors.notFound("留言不存在");
    return toItem(row, groupChildren(rows));
  }

  return {
    async list(params: MessageListParams): Promise<MessageItem[]> {
      const rows = await loadApprovedRows();
      const childrenByParent = groupChildren(rows);

      const topLevel = rows.filter((row) => row.parentId === null);
      const start = (params.page - 1) * params.size;
      return topLevel
        .slice(start, start + params.size)
        .map((row) => toItem(row, childrenByParent));
    },

    async count(): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(message)
        .where(and(eq(message.status, "approved"), isNull(message.parentId)));
      return row?.value ?? 0;
    },

    async create(input: {
      content: string;
      parentId?: number;
      ip: string;
      githubUserId: number;
    }): Promise<MessageItem> {
      if (input.parentId !== undefined) {
        const [parent] = await db
          .select({ id: message.id, status: message.status })
          .from(message)
          .where(eq(message.id, input.parentId))
          .limit(1);
        if (!parent || parent.status !== "approved") {
          throw errors.notFound("被回复的留言不存在");
        }
      }

      const [created] = await db
        .insert(message)
        .values({
          githubUserId: input.githubUserId,
          parentId: input.parentId ?? null,
          content: input.content,
          ip: input.ip,
        })
        .returning({ id: message.id });
      if (!created) throw errors.internal("保存留言失败");

      return getApprovedById(created.id);
    },

    async toggleLike(
      id: number,
      unlike = false,
    ): Promise<MessageItem> {
      await getApprovedById(id);
      const delta = unlike ? -1 : 1;
      await db
        .update(message)
        .set({
          likes: sql<number>`max(0, coalesce(${message.likes}, 0) + ${delta})`,
        })
        .where(eq(message.id, id));
      return getApprovedById(id);
    },
  };
}

export type MessagesService = ReturnType<typeof createMessagesService>;
