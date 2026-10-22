import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { createAuditService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let adminId: number;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-audit-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  adminId = Number(
    connection
      .prepare(
        'INSERT INTO "user" (username, hashed_password, is_admin) VALUES (?, ?, 1)',
      )
      .run("admin", "unused-hash").lastInsertRowid,
  );
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("audit service", () => {
  it("records entries and lists them newest first with actor and detail", async () => {
    const audit = createAuditService(db);

    await audit.record({
      actorId: adminId,
      action: "create",
      targetType: "posts",
      targetId: "12",
      detail: { method: "POST", path: "/api/admin/posts", status: 200 },
      ip: "203.0.113.1",
    });
    await audit.record({
      actorId: adminId,
      action: "delete",
      targetType: "comments",
      targetId: "9",
      detail: { method: "DELETE", path: "/api/admin/comments/9", status: 200 },
      ip: "203.0.113.2",
    });

    const result = await audit.list({ page: 1, size: 20 });

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.action)).toEqual([
      "delete",
      "create",
    ]);
    expect(result.items[0]).toMatchObject({
      actor_id: adminId,
      actor_name: "admin",
      action: "delete",
      target_type: "comments",
      target_id: "9",
      detail: {
        method: "DELETE",
        path: "/api/admin/comments/9",
        status: 200,
      },
      ip: "203.0.113.2",
    });
    expect(result.items[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("filters by action and target type and paginates", async () => {
    const audit = createAuditService(db);

    await audit.record({
      actorId: adminId,
      action: "create",
      targetType: "posts",
      targetId: "1",
    });
    await audit.record({
      actorId: adminId,
      action: "update",
      targetType: "posts",
      targetId: "1",
    });
    await audit.record({
      actorId: adminId,
      action: "create",
      targetType: "projects",
      targetId: "2",
    });

    const filtered = await audit.list({
      page: 1,
      size: 20,
      action: "create",
      targetType: "posts",
    });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0].target_type).toBe("posts");

    const secondPage = await audit.list({ page: 2, size: 2 });
    expect(secondPage.total).toBe(3);
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].action).toBe("create");
    expect(secondPage.items[0].target_type).toBe("posts");
  });

  it("handles system actors, deleted actors and malformed detail", async () => {
    const audit = createAuditService(db);

    await audit.record({ action: "clear", targetType: "visitors" });
    await audit.record({
      actorId: 9999,
      action: "delete",
      targetType: "messages",
      targetId: "3",
    });
    connection
      .prepare(
        'INSERT INTO "admin_audit_log" ("action", "target_type", "detail", "created_at") VALUES (?, ?, ?, ?)',
      )
      .run("legacy", "unknown", "not-json", Date.now());

    const result = await audit.list({ page: 1, size: 20 });

    expect(result.items.map((item) => item.actor_name)).toEqual([
      "系统",
      "已删除管理员",
      "系统",
    ]);
    expect(result.items[0].detail).toEqual({ raw: "not-json" });
  });
});
