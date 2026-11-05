import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { createAnalyticsService } from "./service";

const DAY_MS = 86_400_000;

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let analytics: ReturnType<typeof createAnalyticsService>;
let now: number;

/** 东八区今天 00:00 的 UTC 毫秒，与 service 里的分桶口径一致。 */
function localMidnight(ms: number): number {
  const shifted = new Date(ms + 8 * 3_600_000);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted.getTime() - 8 * 3_600_000;
}

interface VisitorSeed {
  ip?: string;
  path?: string;
  createdAt?: number;
  browser?: string;
  deviceType?: string;
  country?: string;
}

function insertVisitor(seed: VisitorSeed = {}): void {
  connection
    .prepare(
      'INSERT INTO "visitor" ("ip", "path", "browser", "device_type", "country", "created_at") VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      seed.ip ?? "203.0.113.1",
      seed.path ?? "/",
      seed.browser ?? "Chrome",
      seed.deviceType ?? "desktop",
      seed.country ?? "中国",
      // 默认落在一秒前：窗口上界是 Date.now()，同一毫秒插入的行会被 `< until` 排除。
      seed.createdAt ?? now - 1_000,
    );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-analytics-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });
  analytics = createAnalyticsService(db);
  now = Date.now();
});

afterEach(() => {
  connection.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("analytics service", () => {
  it("空库返回补齐后的连续桶", async () => {
    const overview = await analytics.overview(7);

    expect(overview.totals).toEqual({ pv: 0, uv: 0 });
    expect(overview.previous).toEqual({ pv: 0, uv: 0 });
    expect(overview.daily).toHaveLength(7);
    expect(overview.daily.every((bucket) => bucket.pv === 0)).toBe(true);
    expect(overview.hours).toHaveLength(24);
    expect(overview.topPages).toEqual([]);
  });

  it("按东八区分日聚合并统计 PV / UV", async () => {
    const today = localMidnight(now);
    insertVisitor({ ip: "1.1.1.1", createdAt: today + 1 });
    insertVisitor({ ip: "1.1.1.1", createdAt: today + 2 });
    insertVisitor({ ip: "2.2.2.2", createdAt: today + 3 });
    insertVisitor({ ip: "3.3.3.3", createdAt: today - DAY_MS });

    const overview = await analytics.overview(7);

    expect(overview.totals).toEqual({ pv: 4, uv: 3 });

    const last = overview.daily.at(-1);
    expect(last?.pv).toBe(3);
    expect(last?.uv).toBe(2);

    const yesterday = overview.daily.at(-2);
    expect(yesterday?.pv).toBe(1);
    expect(yesterday?.uv).toBe(1);

    // 中间没有数据的日子必须是 0，而不是从数组里消失。
    expect(overview.daily[0]?.pv).toBe(0);
  });

  it("previous 只统计上一个等长窗口", async () => {
    insertVisitor({ ip: "1.1.1.1", createdAt: now - 1_000 });
    insertVisitor({ ip: "2.2.2.2", createdAt: now - 20 * DAY_MS });

    const overview = await analytics.overview(7);

    expect(overview.totals).toEqual({ pv: 1, uv: 1 });
    // 7 天窗口的「上一期」是 7–14 天前，20 天前的行不在里面。
    expect(overview.previous).toEqual({ pv: 0, uv: 0 });

    const wide = await analytics.overview(30);
    expect(wide.totals).toEqual({ pv: 2, uv: 2 });
    expect(wide.previous).toEqual({ pv: 0, uv: 0 });
  });

  it("超出窗口的旧数据不计入", async () => {
    insertVisitor({ createdAt: now - 100 * DAY_MS });

    const overview = await analytics.overview(90);

    expect(overview.totals).toEqual({ pv: 0, uv: 0 });
  });

  it("热门页面按 PV 倒序并截断到 8 条", async () => {
    for (let index = 0; index < 12; index += 1) {
      insertVisitor({ ip: `10.0.0.${index}`, path: `/page-${index}` });
      // 让 /page-1 成为最热的页面。
      if (index === 1) {
        for (let extra = 0; extra < 5; extra += 1) {
          insertVisitor({ ip: `10.1.0.${extra}`, path: "/page-1" });
        }
      }
    }

    const overview = await analytics.overview(7);

    expect(overview.topPages).toHaveLength(8);
    expect(overview.topPages[0]).toMatchObject({ key: "/page-1", pv: 6 });
    const pvList = overview.topPages.map((row) => row.pv);
    expect([...pvList].sort((a, b) => b - a)).toEqual(pvList);
  });

  it("空路径与空维度映射成可读标签", async () => {
    insertVisitor({ path: "", deviceType: "", browser: "", country: "" });

    const overview = await analytics.overview(7);

    expect(overview.topPages[0]?.key).toBe("(未知路径)");
    expect(overview.devices[0]?.key).toBe("未知设备");
    expect(overview.browsers[0]?.key).toBe("未知浏览器");
    expect(overview.countries[0]?.key).toBe("未知地区");
  });

  it("24 小时分布按东八区小时落桶", async () => {
    const today = localMidnight(now);
    // 东八区的 09:00 与 21:00：放在昨天，保证不会因为「当前时刻还没到」被窗口排除。
    insertVisitor({ createdAt: today - DAY_MS + 9 * 3_600_000 });
    insertVisitor({ createdAt: today - DAY_MS + 9 * 3_600_000 + 60_000 });
    insertVisitor({ createdAt: today - DAY_MS + 21 * 3_600_000 });

    const overview = await analytics.overview(7);
    const hour = (value: string) =>
      overview.hours.find((bucket) => bucket.label === value);

    expect(hour("09")?.pv).toBe(2);
    expect(hour("21")?.pv).toBe(1);
    expect(hour("03")?.pv).toBe(0);
  });

  it("range 声明保留天数与窗口起点", async () => {
    const overview = await analytics.overview(14);

    expect(overview.range.days).toBe(14);
    expect(overview.range.retentionDays).toBe(90);
    expect(new Date(overview.range.since).getTime()).toBe(
      localMidnight(now - 13 * DAY_MS),
    );
  });
});
