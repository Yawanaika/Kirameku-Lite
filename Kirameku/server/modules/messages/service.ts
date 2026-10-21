import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { githubUser, message } from "@/server/db/schema";
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

  return {
    async list(params: MessageListParams): Promise<MessageItem[]> {
      const rows = await loadApprovedRows();
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
  };
}

export type MessagesService = ReturnType<typeof createMessagesService>;
