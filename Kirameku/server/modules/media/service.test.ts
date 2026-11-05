import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { mediaListQuery } from "./contracts";
import { createMediaService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let media: ReturnType<typeof createMediaService>;

function insertAlbum(title: string): number {
  const result = connection
    .prepare('INSERT INTO "album" ("title") VALUES (?)')
    .run(title);
  return Number(result.lastInsertRowid);
}

interface PhotoSeed {
  albumId: number;
  url?: string;
  caption?: string;
  bytes?: number | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  createdAt?: number;
}

function insertPhoto(seed: PhotoSeed): number {
  const result = connection
    .prepare(
      'INSERT INTO "photo" ("album_id", "url", "caption", "width", "height", "bytes", "format", "created_at") VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(
      seed.albumId,
      seed.url ?? `/uploads/photo-${Math.random().toString(36).slice(2)}.jpg`,
      seed.caption ?? "",
      seed.width ?? null,
      seed.height ?? null,
      seed.bytes ?? null,
      seed.format ?? null,
      seed.createdAt ?? Date.now(),
    );
  return Number(result.lastInsertRowid);
}

function query(overrides: Partial<Parameters<typeof mediaListQuery.parse>[0]> = {}) {
  return mediaListQuery.parse(overrides);
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-media-"));
  connection = openDatabase(path.join(directory, "app.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });
  media = createMediaService(db);
});

afterEach(() => {
  connection.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("media service", () => {
  it("空库返回空列表与零统计", async () => {
    const overview = await media.overview(query());

    expect(overview.items).toEqual([]);
    expect(overview.total).toBe(0);
    expect(overview.stats).toEqual({
      count: 0,
      bytes: 0,
      missingBytes: 0,
      largest: null,
    });
    expect(overview.albums).toEqual([]);
    expect(overview.albumOptions).toEqual([]);
  });

  it("按体积倒序，未记录体积的排在最后", async () => {
    const albumId = insertAlbum("日常");
    insertPhoto({ albumId, bytes: 1024, caption: "小图" });
    insertPhoto({ albumId, bytes: null, caption: "老照片" });
    insertPhoto({ albumId, bytes: 5 * 1024 * 1024, caption: "巨图" });

    const overview = await media.overview(query());

    expect(overview.items.map((item) => item.caption)).toEqual([
      "巨图",
      "小图",
      "老照片",
    ]);
    expect(overview.stats.bytes).toBe(1024 + 5 * 1024 * 1024);
    // 未记录的要单独计数，否则「已记录总量」看起来像全站总量。
    expect(overview.stats.missingBytes).toBe(1);
    expect(overview.stats.largest?.caption).toBe("巨图");
  });

  it("recent 排序按入库时间从新到旧", async () => {
    const albumId = insertAlbum("日常");
    const base = Date.now();
    insertPhoto({ albumId, caption: "早", createdAt: base - 3000 });
    insertPhoto({ albumId, caption: "晚", createdAt: base - 1000 });
    insertPhoto({ albumId, caption: "中", createdAt: base - 2000 });

    const overview = await media.overview(query({ sort: "recent" }));

    expect(overview.items.map((item) => item.caption)).toEqual(["晚", "中", "早"]);
  });

  it("相册筛选只影响列表，统计仍是全站口径", async () => {
    const first = insertAlbum("日常");
    const second = insertAlbum("旅行");
    insertPhoto({ albumId: first, bytes: 100 });
    insertPhoto({ albumId: second, bytes: 900 });

    const overview = await media.overview(query({ albumId: String(second) }));

    expect(overview.items).toHaveLength(1);
    expect(overview.items[0]?.album_title).toBe("旅行");
    expect(overview.total).toBe(1);
    // 顶部统计回答的是「全站有多大」，跟着筛选变会让人误判。
    expect(overview.stats.count).toBe(2);
    expect(overview.stats.bytes).toBe(1000);
  });

  it("按相册汇总数量与体积", async () => {
    const first = insertAlbum("日常");
    const empty = insertAlbum("空相册");
    insertPhoto({ albumId: first, bytes: 100 });
    insertPhoto({ albumId: first, bytes: 200 });
    insertPhoto({ albumId: first, bytes: null });

    const overview = await media.overview(query());

    const row = overview.albums.find((item) => item.id === first);
    expect(row?.count).toBe(3);
    expect(row?.bytes).toBe(300);

    // 空相册也要出现，否则后台看不见「建了但没图」的相册。
    const emptyRow = overview.albums.find((item) => item.id === empty);
    expect(emptyRow?.count).toBe(0);
    expect(emptyRow?.bytes).toBeNull();

    expect(overview.albums[0]?.id).toBe(first);
  });

  it("分页只切列表，总数保持全量", async () => {
    const albumId = insertAlbum("日常");
    for (let index = 0; index < 5; index += 1) {
      insertPhoto({ albumId, bytes: 1000 - index });
    }

    const first = await media.overview(query({ page: "1", size: "2" }));
    const third = await media.overview(query({ page: "3", size: "2" }));

    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(5);
    expect(third.items).toHaveLength(1);
    expect(third.page).toBe(3);
  });

  it("相册缺失时标题回退为占位文案", async () => {
    const albumId = insertAlbum("日常");
    insertPhoto({ albumId, bytes: 10 });
    // 绕过外键约束模拟历史脏数据：相册被手工删掉但照片还在。
    connection.pragma("foreign_keys = OFF");
    connection.prepare('DELETE FROM "album" WHERE id = ?').run(albumId);

    const overview = await media.overview(query());

    expect(overview.items[0]?.album_title).toBe("(已删除的相册)");
  });
});
