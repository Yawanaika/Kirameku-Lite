import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import { runMigrations } from "@/server/db/migrate";
import {
  ADMIN_COOKIE,
  signAdminToken,
  signGithubToken,
} from "@/server/auth/session";
import { GITHUB_TOKEN_COOKIE } from "@/server/auth/constants";
import { GET as getAlbum } from "./albums/[id]/route";
import { GET as getVisitorsCount } from "./visitors/count/route";
import { POST as previewMarkdown } from "./markdown/preview/route";

/*
 * The admin guard reads `cookies()` from next/headers, so these route tests
 * swap in a mutable cookie jar. DATABASE_PATH must be redirected before any
 * module imports `server/env`, which is why it happens in vi.hoisted.
 */
const envState = vi.hoisted(() => {
  const previous = process.env.DATABASE_PATH;
  const directory = `${process.env.TMPDIR ?? "/tmp"}/kirameku-admin-routes-${process.pid}-${Date.now()}`;
  process.env.DATABASE_PATH = `${directory}/test.db`;
  return { previous, directory };
});

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: new Map<string, string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

let connection: DatabaseConnection;
let adminId: number;
let githubUserId: number;

function request(pathname: string): Request {
  return new Request(`http://localhost:3000${pathname}`);
}

function jsonRequest(pathname: string, body: unknown): Request {
  return new Request(`http://localhost:3000${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeAll(() => {
  fs.mkdirSync(envState.directory, { recursive: true });
  connection = openDatabase(path.join(envState.directory, "test.db"));
  runMigrations(connection);

  adminId = Number(
    connection
      .prepare(
        'INSERT INTO "user" (username, hashed_password, is_admin) VALUES (?, ?, 1)',
      )
      .run("admin", "unused-hash").lastInsertRowid,
  );
  githubUserId = Number(
    connection
      .prepare(
        'INSERT INTO github_user (github_id, login, avatar, bio) VALUES (?, ?, ?, ?)',
      )
      .run(12345, "octocat", "", "").lastInsertRowid,
  );

  connection
    .prepare(
      'INSERT INTO album (title, description, cover, photo_count, sort) VALUES (?, ?, ?, ?, ?)',
    )
    .run("Route test album", "desc", "", 1, 0);
  connection
    .prepare(
      'INSERT INTO photo (album_id, url, caption, orientation, sort) VALUES (?, ?, ?, ?, ?)',
    )
    .run(1, "/uploads/route-test.jpg", "caption", "landscape", 0);
  connection
    .prepare(
      'INSERT INTO visitor (ip, path, user_agent) VALUES (?, ?, ?)',
    )
    .run("127.0.0.1", "/", "vitest");
});

afterAll(async () => {
  connection?.close();
  try {
    const { getSqlite } = await import("@/server/db/client");
    getSqlite().close();
  } catch {
    // The route may have failed before opening the shared connection.
  }
  fs.rmSync(envState.directory, { recursive: true, force: true });

  if (envState.previous === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = envState.previous;
});

beforeEach(() => {
  cookieStore.clear();
});

async function asAdmin(): Promise<void> {
  cookieStore.set(ADMIN_COOKIE, await signAdminToken(adminId));
}

describe("admin API authorization", () => {
  it("rejects anonymous access to album detail and visitor count", async () => {
    const album = await getAlbum(request("/api/admin/albums/1"), params("1"));
    const visitors = await getVisitorsCount(
      request("/api/admin/visitors/count"),
    );

    expect(album.status).toBe(401);
    expect(visitors.status).toBe(401);
  });

  it("does not accept a GitHub visitor session as an admin session", async () => {
    cookieStore.set(
      GITHUB_TOKEN_COOKIE,
      await signGithubToken(githubUserId, "octocat"),
    );

    const album = await getAlbum(request("/api/admin/albums/1"), params("1"));

    expect(album.status).toBe(401);
  });
});

describe("GET /api/admin/albums/[id]", () => {
  it("returns the album and its photos for an admin", async () => {
    await asAdmin();

    const response = await getAlbum(
      request("/api/admin/albums/1"),
      params("1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.album).toMatchObject({
      id: 1,
      title: "Route test album",
      photo_count: 1,
    });
    expect(body.photos).toHaveLength(1);
    expect(body.photos[0]).toMatchObject({
      album_id: 1,
      url: "/uploads/route-test.jpg",
    });
  });

  it("rejects an invalid id with 422", async () => {
    await asAdmin();

    const response = await getAlbum(
      request("/api/admin/albums/not-a-number"),
      params("not-a-number"),
    );

    expect(response.status).toBe(422);
  });

  it("returns 404 for a missing album", async () => {
    await asAdmin();

    const response = await getAlbum(
      request("/api/admin/albums/999"),
      params("999"),
    );

    expect(response.status).toBe(404);
  });
});

describe("GET /api/admin/visitors/count", () => {
  it("returns the total visitor count for an admin", async () => {
    await asAdmin();

    const response = await getVisitorsCount(
      request("/api/admin/visitors/count"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 1 });
  });
});

describe("POST /api/admin/markdown/preview", () => {
  it("requires an admin session", async () => {
    const response = await previewMarkdown(
      jsonRequest("/api/admin/markdown/preview", { content: "# Hi" }),
    );

    expect(response.status).toBe(401);
  });

  it("renders markdown through the sanitizing server pipeline", async () => {
    await asAdmin();

    const response = await previewMarkdown(
      jsonRequest("/api/admin/markdown/preview", {
        content: "# Hi\n\n<script>alert(1)</script>\n\n**bold**",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.html).toContain("<h1>Hi</h1>");
    expect(body.html).toContain("<strong>bold</strong>");
    expect(body.html).not.toContain("<script");
  });

  it("rejects oversized content with 422", async () => {
    await asAdmin();

    const response = await previewMarkdown(
      jsonRequest("/api/admin/markdown/preview", {
        content: "a".repeat(200_001),
      }),
    );

    expect(response.status).toBe(422);
  });
});
