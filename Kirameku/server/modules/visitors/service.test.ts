import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import {
  createVisitorsService,
  getOrgCn,
  parseUserAgent,
} from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;

function insertVisitor(input: {
  ip: string;
  path?: string;
  createdAt: number;
  browser?: string;
  os?: string;
  deviceType?: string;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "visitor"
          ("ip", "path", "user_agent", "city", "region", "country", "district",
           "org", "asn", "is_mobile", "is_proxy", "is_hosting", "browser", "os",
           "device_type", "created_at")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.ip,
        input.path ?? "",
        "",
        "杭州",
        "浙江",
        "中国",
        "",
        "China Mobile",
        "AS56041",
        1,
        0,
        0,
        input.browser ?? "Chrome",
        input.os ?? "macOS",
        input.deviceType ?? "电脑",
        input.createdAt,
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-visitors-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  insertVisitor({
    ip: "203.0.113.1",
    path: "/older",
    createdAt: Date.UTC(2026, 0, 1),
  });
  insertVisitor({
    ip: "203.0.113.2",
    path: "/newer",
    createdAt: Date.UTC(2026, 0, 2),
    browser: "Firefox",
    os: "Windows",
  });
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("visitors service", () => {
  it("counts and lists visitors newest first with org labels", async () => {
    const visitors = createVisitorsService(db);

    await expect(visitors.count()).resolves.toBe(2);
    const rows = await visitors.list({ page: 1, size: 20 });

    expect(rows.map((row) => row.path)).toEqual(["/newer", "/older"]);
    expect(rows[0]).toMatchObject({
      ip: "203.0.113.2",
      city: "杭州",
      region: "浙江",
      country: "中国",
      org: "China Mobile",
      org_cn: "中国移动",
      asn: "AS56041",
      is_mobile: true,
      browser: "Firefox",
      os: "Windows",
      device_type: "电脑",
      created_at: new Date(Date.UTC(2026, 0, 2)).toISOString(),
    });
  });

  it("records a visitor with parsed UA and injected geo data", async () => {
    const visitors = createVisitorsService(db, {
      fetchGeo: async () => ({
        city: "上海",
        region: "上海",
        country: "中国",
        district: "浦东",
        org: "China Telecom",
        asn: "AS4134",
        is_mobile: false,
        is_proxy: false,
        is_hosting: false,
      }),
    });

    await visitors.record({
      ip: "198.51.100.9",
      path: "/recorded",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    });

    const [row] = await visitors.list({ page: 1, size: 1 });
    expect(row).toMatchObject({
      ip: "198.51.100.9",
      path: "/recorded",
      city: "上海",
      district: "浦东",
      org: "China Telecom",
      org_cn: "中国电信",
      browser: "Safari",
      os: "iOS",
      device_type: "手机",
    });
  });

  it("parses common user agents", () => {
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Edg/120.0",
      ),
    ).toEqual({ browser: "Edge", os: "Windows", device_type: "电脑" });
    expect(
      parseUserAgent(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
      ),
    ).toEqual({ browser: "Chrome", os: "Android", device_type: "手机" });
  });

  it("maps common Chinese carriers to readable labels", () => {
    expect(getOrgCn("China Mobile, Beijing", "")).toBe("中国移动(北京)");
    expect(getOrgCn("China Unicom", "AS4837")).toBe("中国联通");
    expect(getOrgCn("China Telecom", "AS4134")).toBe("中国电信");
    expect(getOrgCn("Cloudflare, Inc.", "AS13335")).toBe("Cloudflare");
  });

  it("deletes one visitor and clears all records", async () => {
    const visitors = createVisitorsService(db);
    const [row] = await visitors.list({ page: 1, size: 1 });

    await expect(visitors.remove(row.id)).resolves.toEqual({ ok: true });
    await expect(visitors.count()).resolves.toBe(1);
    await expect(visitors.remove(row.id)).rejects.toMatchObject({
      status: 404,
    });

    await expect(visitors.clear()).resolves.toEqual({ ok: true });
    await expect(visitors.count()).resolves.toBe(0);
  });

  it("prunes records older than the retention window only", async () => {
    insertVisitor({
      ip: "203.0.113.3",
      path: "/fresh",
      createdAt: Date.now(),
    });

    const visitors = createVisitorsService(db);
    await expect(visitors.pruneOlderThan(30)).resolves.toEqual({
      deleted: 2,
    });
    await expect(visitors.count()).resolves.toBe(1);

    const [remaining] = await visitors.list({ page: 1, size: 10 });
    expect(remaining.path).toBe("/fresh");

    await expect(visitors.pruneOlderThan(0)).rejects.toMatchObject({
      status: 400,
    });
  });
});
