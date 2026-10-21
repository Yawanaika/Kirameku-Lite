import { and, count, desc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { chatter } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type { ChatterItem, ChatterListParams } from "./contracts";

type ChatterRow = Pick<
  typeof chatter.$inferSelect,
  | "id"
  | "content"
  | "images"
  | "mood"
  | "likes"
  | "commentsCount"
  | "status"
  | "createdAt"
  | "updatedAt"
>;

function parseImages(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function toItem(row: ChatterRow): ChatterItem {
  return {
    id: row.id,
    content: row.content,
    images: parseImages(row.images),
    mood: row.mood ?? "",
    likes: row.likes ?? 0,
    comments_count: row.commentsCount ?? 0,
    status: row.status ?? "draft",
    created_at: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

export function createChattersService(db: AppDatabase) {
  return {
    async list(params: ChatterListParams): Promise<ChatterItem[]> {
      const rows = await db
        .select({
          id: chatter.id,
          content: chatter.content,
          images: chatter.images,
          mood: chatter.mood,
          likes: chatter.likes,
          commentsCount: chatter.commentsCount,
          status: chatter.status,
          createdAt: chatter.createdAt,
          updatedAt: chatter.updatedAt,
        })
        .from(chatter)
        .where(eq(chatter.status, params.status))
        .orderBy(desc(chatter.createdAt), desc(chatter.id))
        .limit(params.size)
        .offset((params.page - 1) * params.size);

      return rows.map(toItem);
    },

    async getById(
      id: number,
      options: { publishedOnly?: boolean } = {},
    ): Promise<ChatterItem> {
      const conditions = [eq(chatter.id, id)];
      if (options.publishedOnly) {
        conditions.push(eq(chatter.status, "published"));
      }

      const [row] = await db
        .select({
          id: chatter.id,
          content: chatter.content,
          images: chatter.images,
          mood: chatter.mood,
          likes: chatter.likes,
          commentsCount: chatter.commentsCount,
          status: chatter.status,
          createdAt: chatter.createdAt,
          updatedAt: chatter.updatedAt,
        })
        .from(chatter)
        .where(and(...conditions))
        .limit(1);

      if (!row) throw errors.notFound("说说不存在");
      return toItem(row);
    },

    async count(status = "published"): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(chatter)
        .where(eq(chatter.status, status));
      return row?.value ?? 0;
    },
  };
}

export type ChattersService = ReturnType<typeof createChattersService>;
