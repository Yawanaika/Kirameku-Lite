import { and, count, desc, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { chatter } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type {
  ChatterItem,
  ChatterListParams,
  CreateChatterInput,
  UpdateChatterInput,
} from "./contracts";

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
  async function loadById(
    id: number,
    publishedOnly = false,
  ): Promise<ChatterItem> {
    const conditions = [eq(chatter.id, id)];
    if (publishedOnly) conditions.push(eq(chatter.status, "published"));

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
  }

  return {
    async list(params: ChatterListParams): Promise<ChatterItem[]> {
      const conditions = [
        params.status ? eq(chatter.status, params.status) : sql`1 = 1`,
      ];
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
        .where(and(...conditions))
        .orderBy(desc(chatter.createdAt), desc(chatter.id))
        .limit(params.size)
        .offset((params.page - 1) * params.size);

      return rows.map(toItem);
    },

    async getById(
      id: number,
      options: { publishedOnly?: boolean } = {},
    ): Promise<ChatterItem> {
      return loadById(id, options.publishedOnly ?? false);
    },

    async create(input: CreateChatterInput): Promise<ChatterItem> {
      const [row] = await db
        .insert(chatter)
        .values({
          content: input.content,
          images: JSON.stringify(input.images),
          mood: input.mood,
          status: input.status,
        })
        .returning({ id: chatter.id });
      if (!row) throw errors.internal("保存说说失败");

      return loadById(row.id);
    },

    async update(id: number, input: UpdateChatterInput): Promise<ChatterItem> {
      const [existing] = await db
        .select({ id: chatter.id })
        .from(chatter)
        .where(eq(chatter.id, id))
        .limit(1);
      if (!existing) throw errors.notFound("说说不存在");

      const values: Partial<typeof chatter.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.content !== undefined) values.content = input.content;
      if (input.images !== undefined) {
        values.images = JSON.stringify(input.images);
      }
      if (input.mood !== undefined) values.mood = input.mood;
      if (input.status !== undefined) values.status = input.status;

      const [row] = await db
        .update(chatter)
        .set(values)
        .where(eq(chatter.id, id))
        .returning({ id: chatter.id });
      if (!row) throw errors.notFound("说说不存在");

      return loadById(row.id);
    },

    async remove(id: number): Promise<{ ok: true }> {
      const [row] = await db
        .delete(chatter)
        .where(eq(chatter.id, id))
        .returning({ id: chatter.id });
      if (!row) throw errors.notFound("说说不存在");
      return { ok: true };
    },

    async count(status = "published"): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(chatter)
        .where(eq(chatter.status, status));
      return row?.value ?? 0;
    },

    async adminCount(status?: string): Promise<number> {
      const [row] = await db
        .select({ value: count() })
        .from(chatter)
        .where(status ? eq(chatter.status, status) : sql`1 = 1`);
      return row?.value ?? 0;
    },

    async toggleLike(
      id: number,
      unlike = false,
    ): Promise<{ likes: number }> {
      const delta = unlike ? -1 : 1;
      const [row] = await db
        .update(chatter)
        .set({
          likes: sql<number>`max(0, coalesce(${chatter.likes}, 0) + ${delta})`,
        })
        .where(and(eq(chatter.id, id), eq(chatter.status, "published")))
        .returning({ likes: chatter.likes });

      if (!row) throw errors.notFound("说说不存在");
      return { likes: row.likes ?? 0 };
    },
  };
}

export type ChattersService = ReturnType<typeof createChattersService>;
