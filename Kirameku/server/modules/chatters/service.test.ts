import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { AppError } from "@/server/http/errors";
import {
  chatterCountQuery,
  chatterListQuery,
} from "@/server/modules/chatters/contracts";
import { createChattersService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let chatters: ReturnType<typeof createChattersService>;
let publishedA: number;
let publishedB: number;
let draft: number;

function insertChatter(input: {
  content: string;
  images?: string | null;
  mood?: string | null;
  likes?: number;
  commentsCount?: number;
  status: string;
  createdAt: number;
  updatedAt?: number | null;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "chatter"
          ("content", "images", "mood", "likes", "comments_count", "status",
           "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.content,
        input.images ?? "[]",
        input.mood ?? "",
        input.likes ?? 0,
        input.commentsCount ?? 0,
        input.status,
        input.createdAt,
        input.updatedAt ?? null,
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-chatters-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  publishedA = insertChatter({
    content: "first published chatter",
    images: JSON.stringify(["/a.jpg", "/b.jpg"]),
    mood: "开心",
    likes: 3,
    commentsCount: 2,
    status: "published",
    createdAt: Date.UTC(2026, 0, 1),
    updatedAt: null,
  });
  publishedB = insertChatter({
    content: "second published chatter",
    images: "not-json",
    status: "published",
    createdAt: Date.UTC(2026, 0, 2),
    updatedAt: Date.UTC(2026, 0, 3),
  });
  draft = insertChatter({
    content: "draft chatter",
    status: "draft",
    createdAt: Date.UTC(2026, 0, 4),
  });

  chatters = createChattersService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("chatters service", () => {
  it("lists published chatters newest first and parses images", async () => {
    const rows = await chatters.list({
      status: "published",
      page: 1,
      size: 10,
    });

    expect(rows.map((row) => row.id)).toEqual([publishedB, publishedA]);
    expect(rows[0]).toMatchObject({
      content: "second published chatter",
      images: [],
      mood: "",
      likes: 0,
      comments_count: 0,
      status: "published",
      updated_at: new Date(Date.UTC(2026, 0, 3)).toISOString(),
    });
    expect(rows[1]).toMatchObject({
      content: "first published chatter",
      images: ["/a.jpg", "/b.jpg"],
      mood: "开心",
      likes: 3,
      comments_count: 2,
      updated_at: null,
    });
  });

  it("supports pagination", async () => {
    const firstPage = await chatters.list({
      status: "published",
      page: 1,
      size: 1,
    });
    const secondPage = await chatters.list({
      status: "published",
      page: 2,
      size: 1,
    });

    expect(firstPage.map((row) => row.id)).toEqual([publishedB]);
    expect(secondPage.map((row) => row.id)).toEqual([publishedA]);
  });

  it("counts published and draft chatters", async () => {
    await expect(chatters.count("published")).resolves.toBe(2);
    await expect(chatters.count("draft")).resolves.toBe(1);
    await expect(chatters.count()).resolves.toBe(2);
  });

  it("gets a published chatter and hides drafts from public lookup", async () => {
    await expect(
      chatters.getById(publishedA, { publishedOnly: true }),
    ).resolves.toMatchObject({
      id: publishedA,
      content: "first published chatter",
      images: ["/a.jpg", "/b.jpg"],
    });
    await expect(
      chatters.getById(draft, { publishedOnly: true }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(chatters.getById(draft)).resolves.toMatchObject({
      id: draft,
      status: "draft",
    });
    await expect(chatters.getById(999999)).rejects.toBeInstanceOf(AppError);
  });

  it("rejects draft status query parameters for public callers", () => {
    expect(chatterListQuery.safeParse({ status: "draft" }).success).toBe(false);
    expect(chatterCountQuery.safeParse({ status: "draft" }).success).toBe(false);
    expect(chatterListQuery.parse({})).toEqual({
      status: "published",
      page: 1,
      size: 20,
    });
  });
});
