import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { applyLike } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-like-"));
  connection = openDatabase(path.join(directory, "kirameku.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });
});

afterEach(() => {
  connection.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("applyLike", () => {
  it("counts the first like and ignores repeats from the same visitor", async () => {
    const input = {
      targetType: "post" as const,
      targetId: 7,
      visitorKey: "visitor-a",
    };

    expect(await applyLike(db, input)).toBe(true);
    // 刷新页面、清掉 localStorage 再点一次，不应该再 +1。
    expect(await applyLike(db, input)).toBe(false);
    expect(await applyLike(db, input)).toBe(false);
  });

  it("only decrements for a like this visitor actually cast", async () => {
    const base = {
      targetType: "post" as const,
      targetId: 7,
      visitorKey: "visitor-a",
    };

    // 没有点过就取消：不能把别人的赞扣掉。
    expect(await applyLike(db, { ...base, unlike: true })).toBe(false);

    await applyLike(db, base);
    expect(await applyLike(db, { ...base, unlike: true })).toBe(true);
    // 重复取消同样无效。
    expect(await applyLike(db, { ...base, unlike: true })).toBe(false);
  });

  it("keeps visitors, targets and target types independent", async () => {
    const base = { targetType: "post" as const, targetId: 7 };

    expect(await applyLike(db, { ...base, visitorKey: "a" })).toBe(true);
    expect(await applyLike(db, { ...base, visitorKey: "b" })).toBe(true);
    expect(await applyLike(db, { ...base, targetId: 8, visitorKey: "a" })).toBe(
      true,
    );
    // 文章 7 和说说 7 是两个目标。
    expect(
      await applyLike(db, { ...base, targetType: "chatter", visitorKey: "a" }),
    ).toBe(true);
  });

  it("always allows the change when no visitor key is supplied", async () => {
    // 内部调用与测试没有请求上下文，保持原来「点一次算一次」的语义。
    const input = { targetType: "message" as const, targetId: 1 };
    expect(await applyLike(db, input)).toBe(true);
    expect(await applyLike(db, input)).toBe(true);
  });
});
