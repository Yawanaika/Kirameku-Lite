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
import { GET as getAudit } from "./audit/route";
import { POST as createCategory } from "./categories/route";
import { GET as getVisitorsCount } from "./visitors/count/route";
import { DELETE as deleteBackups, GET as getBackups } from "./backups/route";
import { GET as getAnalytics } from "./analytics/route";
import { GET as getMedia } from "./media/route";
import { POST as previewMarkdown } from "./markdown/preview/route";

/*
 * The admin guard reads `cookies()` from next/headers, so these route tests
 * swap in a mutable cookie jar. DATABASE_PATH must be redirected before any
 * module imports `server/env`, which is why it happens in vi.hoisted.
 */
const envState = vi.hoisted(() => {
  const previous = process.env.DATABASE_PATH;
  const previousBackupDir = process.env.BACKUP_DIR;
  const directory = `${process.env.TMPDIR ?? "/tmp"}/kirameku-admin-routes-${process.pid}-${Date.now()}`;
  process.env.DATABASE_PATH = `${directory}/test.db`;
  // 备份面板直接读 BACKUP_DIR，测试用它指向临时目录，避免读到开发机上的真实备份。
  process.env.BACKUP_DIR = `${directory}/backups`;
  return { previous, previousBackupDir, directory };
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
  if (envState.previousBackupDir === undefined) delete process.env.BACKUP_DIR;
  else process.env.BACKUP_DIR = envState.previousBackupDir;
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

describe("GET /api/admin/backups", () => {
  function stamp(hoursAgo: number): string {
    const date = new Date(Date.now() - hoursAgo * 3_600_000);
    return `kirameku-${date.toISOString().replace(/[:.]/g, "-")}`;
  }

  it("requires an admin session", async () => {
    const response = await getBackups(request("/api/admin/backups"));

    expect(response.status).toBe(401);
  });

  it("returns the newest snapshot and its freshness for an admin", async () => {
    await asAdmin();
    fs.mkdirSync(path.join(envState.directory, "backups"), { recursive: true });
    const recent = stamp(2);
    fs.writeFileSync(
      path.join(envState.directory, "backups", `${recent}.db`),
      Buffer.alloc(64),
    );

    const response = await getBackups(request("/api/admin/backups"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.counts).toEqual({
      groups: 1,
      databases: 1,
      uploadsArchives: 0,
    });
    expect(body.latestFile).toBe(`${recent}.db`);
    expect(body.stale).toBe(false);

    fs.rmSync(path.join(envState.directory, "backups"), {
      recursive: true,
      force: true,
    });
  });

  it("reports a stale state when the directory has no snapshots", async () => {
    await asAdmin();

    const response = await getBackups(request("/api/admin/backups"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.counts.groups).toBe(0);
    expect(body.stale).toBe(true);
    expect(body.latestAgeSeconds).toBeNull();
  });
});

describe("DELETE /api/admin/backups", () => {
  function stamp(hoursAgo: number): string {
    const date = new Date(Date.now() - hoursAgo * 3_600_000);
    return `kirameku-${date.toISOString().replace(/[:.]/g, "-")}`;
  }

  function backupPath(name: string): string {
    return path.join(envState.directory, "backups", name);
  }

  function deleteRequest(body: unknown): Request {
    return new Request("http://localhost:3000/api/admin/backups", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function resetBackups(): void {
    fs.rmSync(path.join(envState.directory, "backups"), {
      recursive: true,
      force: true,
    });
    fs.mkdirSync(path.join(envState.directory, "backups"), { recursive: true });
  }

  it("requires an admin session", async () => {
    resetBackups();
    const response = await deleteBackups(
      deleteRequest({ stamps: [stamp(1)] }),
    );

    expect(response.status).toBe(401);
  });

  it("deletes the requested snapshot files", async () => {
    await asAdmin();
    resetBackups();
    const older = stamp(30);
    const newer = stamp(1);
    fs.writeFileSync(backupPath(`${older}.db`), Buffer.alloc(32));
    fs.writeFileSync(backupPath(`${older}.db.meta.json`), Buffer.alloc(4));
    fs.writeFileSync(backupPath(`${newer}.db`), Buffer.alloc(64));

    const response = await deleteBackups(deleteRequest({ stamps: [older] }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deleted).toHaveLength(1);
    expect(body.deleted[0].stamp).toBe(older);
    expect(body.deleted[0].files.sort()).toEqual(
      [`${older}.db`, `${older}.db.meta.json`].sort(),
    );
    expect(fs.existsSync(backupPath(`${older}.db`))).toBe(false);
    expect(fs.existsSync(backupPath(`${newer}.db`))).toBe(true);

    fs.rmSync(path.join(envState.directory, "backups"), {
      recursive: true,
      force: true,
    });
  });

  it("rejects payloads that do not carry valid stamps", async () => {
    await asAdmin();
    resetBackups();

    const empty = await deleteBackups(deleteRequest({ stamps: [] }));
    const traversal = await deleteBackups(
      deleteRequest({ stamps: ["../data/test.db"] }),
    );

    expect(empty.status).toBe(422);
    expect(traversal.status).toBe(422);

    fs.rmSync(path.join(envState.directory, "backups"), {
      recursive: true,
      force: true,
    });
  });
});

describe("GET /api/admin/analytics", () => {
  it("requires an admin session", async () => {
    const response = await getAnalytics(request("/api/admin/analytics"));

    expect(response.status).toBe(401);
  });

  it("returns filled buckets and rejects an out-of-range window", async () => {
    await asAdmin();
    connection
      .prepare(
        'INSERT INTO "visitor" ("ip", "path", "created_at") VALUES (?, ?, ?)',
      )
      .run("198.51.100.7", "/posts/hello", Date.now() - 60_000);

    const response = await getAnalytics(request("/api/admin/analytics?days=7"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.range.days).toBe(7);
    expect(body.daily).toHaveLength(7);
    expect(body.hours).toHaveLength(24);
    expect(body.totals).toEqual({ pv: 1, uv: 1 });
    expect(body.topPages[0]).toMatchObject({ key: "/posts/hello", pv: 1, uv: 1 });

    // 未给参数时按默认 7 天；超过 90 天直接拒绝，而不是静默截断。
    const defaulted = await getAnalytics(request("/api/admin/analytics"));
    expect((await defaulted.json()).range.days).toBe(7);

    const tooWide = await getAnalytics(request("/api/admin/analytics?days=500"));
    // 参数校验失败统一走 422 VALIDATION_ERROR。
    expect(tooWide.status).toBe(422);
  });
});

describe("GET /api/admin/media", () => {
  it("requires an admin session", async () => {
    const response = await getMedia(request("/api/admin/media"));

    expect(response.status).toBe(401);
  });

  it("returns photos sorted by size with global stats", async () => {
    await asAdmin();
    connection
      .prepare(
        'INSERT INTO "photo" ("album_id", "url", "caption", "width", "height", "bytes", "format") VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(1, "/uploads/big.jpg", "Big", 4000, 3000, 2_000_000, "jpeg");
    connection
      .prepare('INSERT INTO "photo" ("album_id", "url", "bytes") VALUES (?, ?, ?)')
      .run(1, "/uploads/legacy.jpg", null);

    const response = await getMedia(request("/api/admin/media?size=10"));
    const body = await response.json();

    expect(response.status).toBe(200);
    // 种子数据里已经有一张照片，加上刚插入的两张。
    expect(body.total).toBe(3);
    // 有体积的排前面，未记录体积的老照片垫底。
    expect(body.items[0].caption).toBe("Big");
    expect(body.items[1].bytes).toBeNull();
    expect(body.items[2].bytes).toBeNull();
    expect(body.stats.bytes).toBe(2_000_000);
    expect(body.stats.missingBytes).toBe(2);
    expect(body.stats.largest.caption).toBe("Big");
    expect(body.albumOptions).toHaveLength(1);
  });

  it("rejects an unknown sort with 422", async () => {
    await asAdmin();

    const response = await getMedia(
      request("/api/admin/media?sort=whatever"),
    );

    expect(response.status).toBe(422);
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

describe("admin audit log", () => {
  it("requires an admin session", async () => {
    const response = await getAudit(request("/api/admin/audit"));

    expect(response.status).toBe(401);
  });

  it("records a successful admin write and lists it newest first", async () => {
    await asAdmin();

    const createdResponse = await createCategory(
      jsonRequest("/api/admin/categories", {
        name: "Audit category",
        slug: "audit-category",
      }),
    );
    expect(createdResponse.status).toBe(200);
    const created = await createdResponse.json();

    const response = await getAudit(
      request("/api/admin/audit?action=create&targetType=categories"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({
      actor_id: adminId,
      actor_name: "admin",
      action: "create",
      target_type: "categories",
      target_id: String(created.id),
      detail: {
        method: "POST",
        path: "/api/admin/categories",
        status: 200,
      },
    });
  });

  it("does not record read-only markdown previews", async () => {
    await asAdmin();

    const before = await getAudit(request("/api/admin/audit"));
    const beforeBody = await before.json();

    const preview = await previewMarkdown(
      jsonRequest("/api/admin/markdown/preview", { content: "# Hi" }),
    );
    expect(preview.status).toBe(200);

    const after = await getAudit(request("/api/admin/audit"));
    const afterBody = await after.json();

    expect(afterBody.total).toBe(beforeBody.total);
  });
});
