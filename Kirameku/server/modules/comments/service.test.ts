import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import {
  chatterCommentsParams,
  createChatterCommentInput,
  createPostCommentInput,
  postCommentsParams,
} from "@/server/modules/comments/contracts";
import { createCommentsService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let comments: ReturnType<typeof createCommentsService>;
let alice: number;
let bob: number;
let publishedPost: number;
let draftPost: number;
let publishedChatter: number;
let draftChatter: number;

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

function insertPost(title: string, slug: string, status: string): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "post"
          ("title", "slug", "status", "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        title,
        slug,
        status,
        Date.UTC(2026, 0, 1),
        Date.UTC(2026, 0, 1),
      ).lastInsertRowid,
  );
}

function insertChatter(content: string, status: string): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "chatter"
          ("content", "status", "created_at")
         VALUES (?, ?, ?)`,
      )
      .run(content, status, Date.UTC(2026, 0, 1)).lastInsertRowid,
  );
}

function insertComment(input: {
  postId: number;
  content: string;
  githubUserId?: number | null;
  parentId?: number | null;
  status?: string;
  likes?: number;
  createdAt: number;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "comment"
          ("post_id", "parent_id", "github_user_id", "content", "likes", "status", "created_at")
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.postId,
        input.parentId ?? null,
        input.githubUserId ?? null,
        input.content,
        input.likes ?? 0,
        input.status ?? "approved",
        input.createdAt,
      ).lastInsertRowid,
  );
}

function insertChatterComment(input: {
  chatterId: number;
  content: string;
  githubUserId?: number | null;
  parentId?: number | null;
  status?: string;
  likes?: number;
  createdAt: number;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "chatter_comment"
          ("chatter_id", "parent_id", "github_user_id", "content", "likes", "status", "created_at")
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.chatterId,
        input.parentId ?? null,
        input.githubUserId ?? null,
        input.content,
        input.likes ?? 0,
        input.status ?? "approved",
        input.createdAt,
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-comments-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  alice = insertUser(1001, "alice");
  bob = insertUser(1002, "bob");
  publishedPost = insertPost("Published Post", "published-post", "published");
  draftPost = insertPost("Draft Post", "draft-post", "draft");
  publishedChatter = insertChatter("published chatter", "published");
  draftChatter = insertChatter("draft chatter", "draft");

  const postRootA = insertComment({
    postId: publishedPost,
    content: "post root A",
    githubUserId: alice,
    likes: 3,
    createdAt: Date.UTC(2026, 0, 1),
  });
  insertComment({
    postId: publishedPost,
    content: "post root B",
    githubUserId: bob,
    createdAt: Date.UTC(2026, 0, 2),
  });
  insertComment({
    postId: publishedPost,
    content: "post rejected root",
    githubUserId: alice,
    status: "rejected",
    createdAt: Date.UTC(2026, 0, 3),
  });
  const postReplyOne = insertComment({
    postId: publishedPost,
    content: "post reply 1",
    githubUserId: bob,
    parentId: postRootA,
    createdAt: Date.UTC(2026, 0, 1, 12),
  });
  insertComment({
    postId: publishedPost,
    content: "post nested",
    githubUserId: alice,
    parentId: postReplyOne,
    createdAt: Date.UTC(2026, 0, 1, 12, 30),
  });
  insertComment({
    postId: publishedPost,
    content: "post reply 2",
    githubUserId: alice,
    parentId: postRootA,
    createdAt: Date.UTC(2026, 0, 1, 13),
  });
  insertComment({
    postId: publishedPost,
    content: "post rejected reply",
    githubUserId: bob,
    parentId: postRootA,
    status: "rejected",
    createdAt: Date.UTC(2026, 0, 1, 14),
  });
  insertComment({
    postId: draftPost,
    content: "draft post comment",
    githubUserId: alice,
    createdAt: Date.UTC(2026, 0, 4),
  });

  const chatterRootA = insertChatterComment({
    chatterId: publishedChatter,
    content: "chatter root A",
    githubUserId: alice,
    likes: 2,
    createdAt: Date.UTC(2026, 0, 1),
  });
  insertChatterComment({
    chatterId: publishedChatter,
    content: "chatter root B",
    githubUserId: bob,
    createdAt: Date.UTC(2026, 0, 2),
  });
  insertChatterComment({
    chatterId: publishedChatter,
    content: "chatter rejected root",
    githubUserId: alice,
    status: "rejected",
    createdAt: Date.UTC(2026, 0, 3),
  });
  insertChatterComment({
    chatterId: publishedChatter,
    content: "chatter reply",
    githubUserId: bob,
    parentId: chatterRootA,
    createdAt: Date.UTC(2026, 0, 1, 12),
  });
  insertChatterComment({
    chatterId: draftChatter,
    content: "draft chatter comment",
    githubUserId: alice,
    createdAt: Date.UTC(2026, 0, 4),
  });

  comments = createCommentsService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("comments service", () => {
  it("lists approved post comments for published posts as a newest-first tree", async () => {
    const roots = await comments.listPostComments(publishedPost);

    expect(roots.map((root) => root.content)).toEqual([
      "post root B",
      "post root A",
    ]);
    expect(roots[0].replies).toEqual([]);
    expect(roots[1]).toMatchObject({
      post_id: publishedPost,
      parent_id: null,
      content: "post root A",
      likes: 3,
      status: "approved",
      created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      github_user: {
        id: alice,
        login: "alice",
        avatar: "https://avatars.example/alice.png",
        bio: "alice bio",
      },
    });
    expect(roots[1].replies.map((reply) => reply.content)).toEqual([
      "post reply 2",
      "post reply 1",
    ]);
    expect(roots[1].replies[1].replies.map((reply) => reply.content)).toEqual([
      "post nested",
    ]);
    expect(JSON.stringify(roots)).not.toContain("rejected");
    expect(JSON.stringify(roots)).not.toContain("draft post comment");
  });

  it("does not expose post comments for draft or missing posts", async () => {
    await expect(comments.listPostComments(draftPost)).resolves.toEqual([]);
    await expect(comments.listPostComments(999999)).resolves.toEqual([]);
  });

  it("lists approved chatter comments for published chatters only", async () => {
    const roots = await comments.listChatterComments(publishedChatter);

    expect(roots.map((root) => root.content)).toEqual([
      "chatter root B",
      "chatter root A",
    ]);
    expect(roots[1]).toMatchObject({
      chatter_id: publishedChatter,
      parent_id: null,
      likes: 2,
      status: "approved",
      github_user: { login: "alice" },
    });
    expect(roots[1].replies.map((reply) => reply.content)).toEqual([
      "chatter reply",
    ]);
    expect(JSON.stringify(roots)).not.toContain("rejected");
    await expect(comments.listChatterComments(draftChatter)).resolves.toEqual(
      [],
    );
    await expect(
      comments.listChatterComments(999999),
    ).resolves.toEqual([]);
  });

  it("creates post comments and toggles likes", async () => {
    const root = await comments.createPostComment({
      postId: publishedPost,
      content: "new root",
      ip: "127.0.0.1",
      githubUserId: alice,
    });

    expect(root).toMatchObject({
      post_id: publishedPost,
      parent_id: null,
      content: "new root",
      likes: 0,
      status: "approved",
      github_user: { id: alice, login: "alice" },
      replies: [],
    });

    const reply = await comments.createPostComment({
      postId: publishedPost,
      parentId: root.id,
      content: "new reply",
      ip: "127.0.0.1",
      githubUserId: bob,
    });
    expect(reply.parent_id).toBe(root.id);
    expect(reply.github_user).toMatchObject({ login: "bob" });

    await expect(
      comments.createPostComment({
        postId: draftPost,
        content: "not allowed",
        ip: "127.0.0.1",
        githubUserId: alice,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      comments.createPostComment({
        postId: publishedPost,
        parentId: 999999,
        content: "missing parent",
        ip: "127.0.0.1",
        githubUserId: alice,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(comments.togglePostCommentLike(root.id)).resolves.toMatchObject(
      { likes: 1 },
    );
    await expect(
      comments.togglePostCommentLike(root.id, true),
    ).resolves.toMatchObject({ likes: 0 });
  });

  it("creates chatter comments and increments the chatter comment count", async () => {
    const before = connection
      .prepare('SELECT comments_count AS value FROM "chatter" WHERE id = ?')
      .get(publishedChatter) as { value: number };

    const created = await comments.createChatterComment({
      chatterId: publishedChatter,
      content: "new chatter comment",
      ip: "127.0.0.1",
      githubUserId: bob,
    });

    expect(created).toMatchObject({
      chatter_id: publishedChatter,
      parent_id: null,
      content: "new chatter comment",
      likes: 0,
      status: "approved",
      github_user: { id: bob, login: "bob" },
      replies: [],
    });

    const after = connection
      .prepare('SELECT comments_count AS value FROM "chatter" WHERE id = ?')
      .get(publishedChatter) as { value: number };
    expect(after.value).toBe(before.value + 1);

    await expect(
      comments.toggleChatterCommentLike(created.id),
    ).resolves.toMatchObject({ likes: 1 });
    await expect(
      comments.toggleChatterCommentLike(created.id, true),
    ).resolves.toMatchObject({ likes: 0 });

    await expect(
      comments.createChatterComment({
        chatterId: draftChatter,
        content: "not allowed",
        ip: "127.0.0.1",
        githubUserId: alice,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("validates post and chatter comment ids and create inputs", () => {
    expect(postCommentsParams.parse({ postId: "12" })).toEqual({ postId: 12 });
    expect(chatterCommentsParams.parse({ chatterId: "34" })).toEqual({
      chatterId: 34,
    });
    expect(postCommentsParams.safeParse({ postId: "0" }).success).toBe(false);
    expect(postCommentsParams.safeParse({ postId: "abc" }).success).toBe(false);
    expect(
      chatterCommentsParams.safeParse({ chatterId: "0" }).success,
    ).toBe(false);

    expect(
      createPostCommentInput.parse({
        post_id: "12",
        parent_id: null,
        content: "  hello  ",
      }),
    ).toEqual({ post_id: 12, parent_id: undefined, content: "hello" });
    expect(
      createChatterCommentInput.safeParse({
        chatter_id: 1,
        content: "",
      }).success,
    ).toBe(false);
  });
});
