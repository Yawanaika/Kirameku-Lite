import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import {
  createMessageInput,
  messageCountQuery,
  messageIdParams,
  messageListQuery,
} from "@/server/modules/messages/contracts";
import { createMessagesService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let messages: ReturnType<typeof createMessagesService>;
let alice: number;
let bob: number;
let topOne: number;
let topTwo: number;
let replyOne: number;

function insertUser(githubId: number, login: string): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "github_user"
          ("github_id", "login", "avatar", "bio", "created_at")
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        githubId,
        login,
        `https://avatars.example/${login}.png`,
        `${login} bio`,
        Date.UTC(2026, 0, 1),
      ).lastInsertRowid,
  );
}

function insertMessage(input: {
  content: string;
  githubUserId?: number | null;
  parentId?: number | null;
  status?: string;
  likes?: number;
  ip?: string;
  createdAt: number;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "message"
          ("github_user_id", "parent_id", "content", "ip", "status", "likes", "created_at")
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.githubUserId ?? null,
        input.parentId ?? null,
        input.content,
        input.ip ?? "",
        input.status ?? "approved",
        input.likes ?? 0,
        input.createdAt,
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-messages-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  alice = insertUser(1001, "alice");
  bob = insertUser(1002, "bob");

  topOne = insertMessage({
    content: "top one",
    githubUserId: alice,
    likes: 4,
    ip: "127.0.0.1",
    createdAt: Date.UTC(2026, 0, 1),
  });
  topTwo = insertMessage({
    content: "top two",
    githubUserId: bob,
    createdAt: Date.UTC(2026, 0, 2),
  });
  insertMessage({
    content: "rejected top",
    githubUserId: alice,
    status: "rejected",
    createdAt: Date.UTC(2026, 0, 3),
  });
  replyOne = insertMessage({
    content: "first reply",
    githubUserId: bob,
    parentId: topOne,
    createdAt: Date.UTC(2026, 0, 1, 12),
  });
  insertMessage({
    content: "second reply",
    githubUserId: alice,
    parentId: topOne,
    createdAt: Date.UTC(2026, 0, 1, 13),
  });
  insertMessage({
    content: "nested reply",
    githubUserId: alice,
    parentId: replyOne,
    createdAt: Date.UTC(2026, 0, 1, 12, 30),
  });
  insertMessage({
    content: "rejected reply",
    githubUserId: bob,
    parentId: topOne,
    status: "rejected",
    createdAt: Date.UTC(2026, 0, 1, 14),
  });

  messages = createMessagesService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("messages service", () => {
  it("lists approved top-level messages newest first with approved reply trees", async () => {
    const rows = await messages.list({ page: 1, size: 20 });

    expect(rows.map((row) => row.id)).toEqual([topTwo, topOne]);
    expect(rows[0]).toMatchObject({
      content: "top two",
      github_user: { login: "bob" },
      replies: [],
    });
    expect(rows[1]).toMatchObject({
      content: "top one",
      github_user_id: alice,
      parent_id: null,
      ip: "127.0.0.1",
      status: "approved",
      likes: 4,
      created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      github_user: {
        id: alice,
        login: "alice",
        avatar: "https://avatars.example/alice.png",
        bio: "alice bio",
      },
    });
    expect(rows[1].replies.map((reply) => reply.content)).toEqual([
      "first reply",
      "second reply",
    ]);
    expect(rows[1].replies[0].github_user).toMatchObject({ login: "bob" });
    expect(rows[1].replies[0].replies.map((reply) => reply.content)).toEqual([
      "nested reply",
    ]);
    expect(rows[1].replies.some((reply) => reply.content === "rejected reply"))
      .toBe(false);
  });

  it("paginates top-level messages without splitting reply trees", async () => {
    const firstPage = await messages.list({ page: 1, size: 1 });
    const secondPage = await messages.list({ page: 2, size: 1 });

    expect(firstPage.map((row) => row.id)).toEqual([topTwo]);
    expect(secondPage.map((row) => row.id)).toEqual([topOne]);
    expect(secondPage[0].replies).toHaveLength(2);
  });

  it("counts approved top-level messages only", async () => {
    await expect(messages.count()).resolves.toBe(2);
  });

  it("creates messages and replies and toggles likes", async () => {
    const created = await messages.create({
      content: "new message",
      ip: "127.0.0.1",
      githubUserId: alice,
    });

    expect(created).toMatchObject({
      github_user_id: alice,
      parent_id: null,
      content: "new message",
      likes: 0,
      status: "approved",
      github_user: { id: alice, login: "alice" },
      replies: [],
    });

    const reply = await messages.create({
      content: "new reply",
      parentId: created.id,
      ip: "127.0.0.1",
      githubUserId: bob,
    });
    expect(reply.parent_id).toBe(created.id);
    expect(reply.github_user).toMatchObject({ login: "bob" });

    await expect(
      messages.create({
        content: "missing parent",
        parentId: 999999,
        ip: "127.0.0.1",
        githubUserId: alice,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(messages.toggleLike(created.id)).resolves.toMatchObject({
      likes: 1,
    });
    await expect(
      messages.toggleLike(created.id, true),
    ).resolves.toMatchObject({ likes: 0 });
  });

  it("lists all message statuses for admin with full reply trees", async () => {
    const rows = await messages.listAdmin({ page: 1, size: 20 });

    expect(rows.map((row) => row.id)).toEqual([3, topTwo, topOne]);
    expect(rows[0]).toMatchObject({
      content: "rejected top",
      status: "rejected",
    });
    expect(rows[2].replies.map((reply) => reply.content)).toEqual([
      "first reply",
      "second reply",
      "rejected reply",
    ]);
    expect(rows[2].replies[0].replies.map((reply) => reply.content)).toEqual([
      "nested reply",
    ]);
    expect(rows[2].replies[2].status).toBe("rejected");

    const rejected = await messages.listAdmin({
      status: "rejected",
      page: 1,
      size: 20,
    });
    expect(rejected.map((row) => row.content)).toEqual(["rejected top"]);
  });

  it("counts, updates and deletes messages for admin", async () => {
    await expect(messages.adminCount()).resolves.toBe(3);
    await expect(messages.adminCount("approved")).resolves.toBe(2);
    await expect(messages.adminCount("rejected")).resolves.toBe(1);

    await expect(messages.updateStatus(3, "approved")).resolves.toMatchObject({
      id: 3,
      content: "rejected top",
      status: "approved",
    });
    await expect(messages.adminCount("approved")).resolves.toBe(3);
    await expect(
      messages.updateStatus(999999, "approved"),
    ).rejects.toMatchObject({ status: 404 });

    await expect(messages.remove(topOne)).resolves.toEqual({ ok: true });
    await expect(messages.remove(topOne)).rejects.toMatchObject({
      status: 404,
    });

    const remaining = connection
      .prepare('SELECT COUNT(*) AS "count" FROM "message" WHERE "id" = ? OR "parent_id" = ?')
      .get(topOne, topOne) as { count: number };
    expect(remaining.count).toBe(0);
  });

  it("rejects non-approved status query parameters", () => {
    expect(messageListQuery.parse({})).toEqual({
      status: "approved",
      page: 1,
      size: 20,
    });
    expect(messageListQuery.safeParse({ status: "rejected" }).success).toBe(
      false,
    );
    expect(messageCountQuery.safeParse({ status: "rejected" }).success).toBe(
      false,
    );
    expect(messageListQuery.safeParse({ size: 101 }).success).toBe(false);

    expect(
      createMessageInput.parse({ content: "  hello  ", parent_id: null }),
    ).toEqual({ content: "hello", parent_id: undefined });
    expect(createMessageInput.safeParse({ content: "" }).success).toBe(false);
    expect(messageIdParams.parse({ messageId: "12" })).toEqual({
      messageId: 12,
    });
  });
});
