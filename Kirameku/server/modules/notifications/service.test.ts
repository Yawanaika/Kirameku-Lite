import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { SECRET_MASK, SECRET_UNCHANGED } from "./contracts";
import { createNotificationsService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let service: ReturnType<typeof createNotificationsService>;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-notifications-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });
  service = createNotificationsService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

function storedChannelConfig(type: string): Record<string, unknown> {
  const row = connection
    .prepare(`SELECT "config" FROM "notification_channel" WHERE "type" = ?`)
    .get(type) as { config: string } | undefined;
  return JSON.parse(row?.config ?? "{}") as Record<string, unknown>;
}

function insertLog(input: {
  eventKey: string;
  status: "success" | "failed" | "skipped";
  channelType?: string;
  title?: string;
}) {
  connection
    .prepare(
      `INSERT INTO "notification_log"
        ("event_key", "level", "title", "body", "channel_type", "status", "error", "duration_ms", "created_at")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.eventKey,
      "warning",
      input.title ?? "测试消息",
      "",
      input.channelType ?? "telegram",
      input.status,
      "",
      12,
      Date.now(),
    );
}

const telegramConfig = {
  botToken: "123456789:AAsecret-token-value",
  chatId: "-1001234567890",
};

describe("notifications service", () => {
  it("seeds default channels and rules on first read", async () => {
    const state = await service.getState();

    expect(state.channels.map((channel) => channel.type)).toEqual([
      "telegram",
      "email",
      "webhook",
    ]);
    expect(state.channels.every((channel) => !channel.enabled)).toBe(true);
    expect(state.rules.length).toBeGreaterThan(0);
    expect(state.logs).toEqual([]);
    expect(state.log_total).toBe(0);

    const errorRate = state.rules.find((rule) => rule.event_key === "http.error_rate");
    expect(errorRate).toMatchObject({
      enabled: true,
      channels: [],
      last_fired_at: null,
    });
    expect(errorRate?.settings).toMatchObject({
      maxErrorPercent: 5,
      minRequests: 20,
    });

    const messageCreated = state.rules.find(
      (rule) => rule.event_key === "message.created",
    );
    expect(messageCreated).toMatchObject({
      enabled: true,
      channels: [],
      cooldown_seconds: 0,
      thresholds: [],
    });
  });

  it("refuses to enable a channel with missing required fields", async () => {
    await expect(
      service.updateChannel("telegram", {
        enabled: true,
        config: { chatId: "-1001234567890" },
      }),
    ).rejects.toThrow(/Bot Token/);

    const state = await service.getState();
    const telegram = state.channels.find((channel) => channel.type === "telegram");
    expect(telegram?.enabled).toBe(false);
  });

  it("seals secrets at rest and masks them in responses", async () => {
    const view = await service.updateChannel("telegram", {
      enabled: true,
      config: telegramConfig,
    });

    expect(view.enabled).toBe(true);
    expect(view.configured).toBe(true);
    expect(view.config.botToken).toBe(SECRET_MASK);
    expect(view.config.chatId).toBe("-1001234567890");

    const raw = storedChannelConfig("telegram");
    expect(typeof raw.botToken).toBe("string");
    expect(raw.botToken).not.toBe(telegramConfig.botToken);
    expect(String(raw.botToken)).toMatch(/^(enc:v1:|plain:)/);
  });

  it("keeps the stored secret when the mask is posted back", async () => {
    await service.updateChannel("telegram", {
      enabled: true,
      config: telegramConfig,
    });
    const sealed = storedChannelConfig("telegram").botToken;

    await service.updateChannel("telegram", {
      config: { botToken: SECRET_MASK, chatId: "-1009999999999" },
    });
    const afterMask = storedChannelConfig("telegram");
    expect(afterMask.botToken).toBe(sealed);
    expect(afterMask.chatId).toBe("-1009999999999");

    await service.updateChannel("telegram", {
      config: { botToken: SECRET_UNCHANGED },
    });
    expect(storedChannelConfig("telegram").botToken).toBe(sealed);
  });

  it("clears a stored field when an empty string is posted", async () => {
    await service.updateChannel("webhook", {
      config: { url: "https://example.com/hook", secret: "sign-me" },
    });
    const before = storedChannelConfig("webhook");
    expect(before.url).toBe("https://example.com/hook");
    expect(String(before.secret)).toMatch(/^(enc:v1:|plain:)/);

    await service.updateChannel("webhook", { config: { url: "" } });
    expect(storedChannelConfig("webhook").url).toBeUndefined();
  });

  it("clamps rule thresholds and rejects unknown events", async () => {
    const rule = await service.updateRule("http.error_rate", {
      settings: { maxErrorPercent: 500, minRequests: 0 },
      cooldownSeconds: 600,
      channels: ["telegram"],
    });

    expect(rule.settings.maxErrorPercent).toBe(100);
    expect(rule.settings.minRequests).toBe(1);
    expect(rule.cooldown_seconds).toBe(600);
    expect(rule.channels).toEqual(["telegram"]);

    await expect(
      service.updateRule("does.not.exist", { enabled: false }),
    ).rejects.toThrow(/未知的预警事件/);
  });

  it("skips delivery when the rule is disabled", async () => {
    await service.updateRule("backup.stale", { enabled: false });

    const result = await service.notify(
      {
        eventKey: "backup.stale",
        level: "warning",
        title: "备份过期",
        body: "最近备份超过 30 小时",
        force: false,
        fields: [],
      },
      { recordSkip: true },
    );

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe("rule-disabled");
    expect(result.outcomes).toEqual([]);

    const logs = await service.listLogs({ page: 1, size: 20 });
    expect(logs.total).toBe(1);
    expect(logs.items[0]).toMatchObject({
      event_key: "backup.stale",
      status: "skipped",
      channel_type: "",
    });
  });

  it("reports no-channel when the rule has no channels selected", async () => {
    await service.updateRule("disk.low", { channels: [] });

    const result = await service.notify({
      eventKey: "disk.low",
      level: "critical",
      title: "磁盘空间不足",
      body: "剩余 1.2 GB",
      force: false,
      fields: [],
    });

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe("no-channel");
    expect(result.reason).toContain("没有为该事件选择推送渠道");
  });

  it("honours the cooldown window unless forced", async () => {
    await service.updateRule("db.busy", {
      channels: ["telegram"],
      cooldownSeconds: 3600,
    });
    connection
      .prepare(`UPDATE "notification_rule" SET "last_fired_at" = ? WHERE "event_key" = ?`)
      .run(Date.now(), "db.busy");

    const blocked = await service.notify({
      eventKey: "db.busy",
      level: "warning",
      title: "数据库繁忙",
      body: "等待锁超过 5 秒",
      force: false,
      fields: [],
    });
    expect(blocked.sent).toBe(false);
    expect(blocked.skipped).toBe("cooldown");
    expect(blocked.reason).toContain("冷却中");

    const forced = await service.notify({
      eventKey: "db.busy",
      level: "warning",
      title: "数据库繁忙",
      body: "等待锁超过 5 秒",
      force: true,
      fields: [],
    });
    expect(forced.skipped).toBeUndefined();
    expect(forced.sent).toBe(false);
    expect(forced.reason).toContain("没有可用的推送渠道");
  });

  it("requires a complete channel configuration before sending a test", async () => {
    await service.updateChannel("email", {
      config: { host: "smtp.example.com", from: "bot@example.com" },
    });

    await expect(service.testChannel("email")).rejects.toThrow(/配置不完整/);
  });

  it("filters and pages the notification log", async () => {
    insertLog({ eventKey: "backup.stale", status: "success" });
    insertLog({ eventKey: "disk.low", status: "failed" });
    insertLog({ eventKey: "disk.low", status: "success" });

    const all = await service.listLogs({ page: 1, size: 2 });
    expect(all.total).toBe(3);
    expect(all.items).toHaveLength(2);
    expect(all.items[0].event_key).toBe("disk.low");

    const failed = await service.listLogs({ page: 1, size: 20, status: "failed" });
    expect(failed.total).toBe(1);
    expect(failed.items[0].status).toBe("failed");

    const perEvent = await service.listLogs({
      page: 1,
      size: 20,
      eventKey: "disk.low",
    });
    expect(perEvent.total).toBe(2);
  });
});
