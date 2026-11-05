import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetricsSnapshot } from "@/server/http/metrics";

/**
 * checks.ts 的每条判断都读进程级副作用（SQLite 连接、metrics 计数器），
 * 所以这里把两个来源都打桩，只验证阈值判定与文案本身。
 */
const state = vi.hoisted(() => ({
  metrics: null as MetricsSnapshot | null,
  sqlite: null as unknown,
}));

vi.mock("@/server/http/metrics", () => ({
  getMetrics: () => state.metrics,
}));

vi.mock("@/server/db/client", () => ({
  getSqlite: () => state.sqlite,
}));

const { runNotificationChecks, resetCheckBaseline } = await import("./checks");
type Service = Parameters<typeof runNotificationChecks>[0];
type RuleState = Awaited<ReturnType<Service["getRuleState"]>>;

function metricsOf(overrides: Partial<MetricsSnapshot> = {}): MetricsSnapshot {
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    uptime_s: 100,
    requests_total: 0,
    errors_total: 0,
    sqlite_busy_total: 0,
    requests_by_status: {},
    latency_ms: { count: 0, p50: null, p95: null, p99: null, max: null },
    event_loop_lag_ms: { p50: 0, p95: 0, p99: 0, max: 0 },
    memory_mb: { rss: 100, heap_used: 50, heap_total: 60, external: 1 },
    db: {
      path: "/data/kirameku.db",
      size_bytes: 1024,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
    },
    backups: {
      dir: "/data/backups",
      count: 3,
      uploads_archives: 0,
      total_bytes: 1024,
      latest_file: "kirameku-20260101.db",
      latest_age_s: 3600,
    },
    disk: {
      path: "/data",
      total_bytes: 100 * 1024 ** 3,
      used_bytes: 50 * 1024 ** 3,
      available_bytes: 50 * 1024 ** 3,
    },
    ...overrides,
  };
}

/** 内存里的假 SQLite：只要 SELECT 1 与 quick_check 能返回预期值即可。 */
function fakeSqlite(options: { pendingFriendLinks?: number; quickCheck?: string } = {}) {
  return {
    prepare(sql: string) {
      if (sql.includes("friend_link")) {
        return { get: () => ({ total: options.pendingFriendLinks ?? 0 }) };
      }
      if (sql.includes("quick_check")) {
        return {
          get: () => ({ quick_check: options.quickCheck ?? "ok" }),
        };
      }
      return { get: () => ({ "1": 1 }) };
    },
    pragma: () => [{ quick_check: options.quickCheck ?? "ok" }],
  };
}

function stubService(rules: Record<string, Partial<NonNullable<RuleState>>> = {}) {
  const notified: string[] = [];
  const service = {
    getRuleState: async (eventKey: string) => {
      const rule = rules[eventKey];
      if (rule === undefined) return null;
      return {
        enabled: true,
        channels: [],
        thresholds: {},
        cooldownSeconds: 0,
        ...rule,
      } as NonNullable<RuleState>;
    },
    notify: async (input: { eventKey: string }) => {
      notified.push(input.eventKey);
      return { eventKey: input.eventKey, sent: true, outcomes: [] };
    },
  };
  return { service: service as unknown as Service, notified };
}

beforeEach(() => {
  resetCheckBaseline();
  state.metrics = metricsOf();
  state.sqlite = fakeSqlite();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetCheckBaseline();
});

describe("runNotificationChecks", () => {
  it("keeps quiet when every signal is within its threshold", async () => {
    const { service, notified } = stubService({
      "backup.stale": {},
      "disk.low": {},
      "db.busy": {},
      "content.pending": {},
    });

    const report = await runNotificationChecks(service);

    expect(report.triggered).toEqual([]);
    expect(notified).toEqual([]);
    expect(report.errors).toEqual([]);
    expect(report.outcomes.map((outcome) => outcome.eventKey)).toEqual([
      "http.error_rate",
      "http.not_found_burst",
      "backup.stale",
      "disk.low",
      "db.busy",
      "site.health",
      "content.pending",
    ]);
  });

  it("fails the backup check when the backup directory is empty", async () => {
    state.metrics = metricsOf({
      backups: {
        dir: "/data/backups",
        count: 0,
        uploads_archives: 0,
        total_bytes: 0,
        latest_file: null,
        latest_age_s: null,
      },
    });
    const { service, notified } = stubService({ "backup.stale": {} });

    const report = await runNotificationChecks(service);

    expect(report.triggered).toContain("backup.stale");
    expect(notified).toContain("backup.stale");
    const outcome = report.outcomes.find((o) => o.eventKey === "backup.stale");
    expect(outcome?.detail).toBe("没有备份文件");
    expect(outcome?.body).toContain("/data/backups");
  });

  it("honours the configured backup age threshold", async () => {
    state.metrics = metricsOf({
      backups: {
        dir: "/data/backups",
        count: 1,
        uploads_archives: 0,
        total_bytes: 1024,
        latest_file: "kirameku.db",
        latest_age_s: 48 * 3600,
      },
    });

    const relaxed = stubService({
      "backup.stale": { thresholds: { maxAgeHours: 72 } },
    });
    expect((await runNotificationChecks(relaxed.service)).triggered).not.toContain(
      "backup.stale",
    );

    resetCheckBaseline();
    const strict = stubService({
      "backup.stale": { thresholds: { maxAgeHours: 12 } },
    });
    expect((await runNotificationChecks(strict.service)).triggered).toContain(
      "backup.stale",
    );
  });

  it("triggers the disk check only below the free-space threshold", async () => {
    state.metrics = metricsOf({
      disk: {
        path: "/data",
        total_bytes: 100 * 1024 ** 3,
        used_bytes: 99 * 1024 ** 3,
        available_bytes: 1024 ** 3,
      },
    });
    const { service } = stubService({ "disk.low": {} });

    const report = await runNotificationChecks(service);

    expect(report.triggered).toContain("disk.low");
    const outcome = report.outcomes.find((o) => o.eventKey === "disk.low");
    expect(outcome?.fields).toContainEqual({ label: "阈值", value: "2 GB" });
  });

  it("only judges HTTP rates once a baseline exists", async () => {
    const { service } = stubService({});
    state.metrics = metricsOf({ requests_total: 100, errors_total: 50 });

    const first = await runNotificationChecks(service);
    // 第一次只建立基线：不能拿从进程启动到现在的累计值当区间值。
    expect(first.triggered).toEqual([]);
    expect(
      first.outcomes.find((o) => o.eventKey === "http.error_rate")?.detail,
    ).toBe("已建立计数器基线");

    // 之后 40 次请求里有 20 个 5xx，超过 5% 阈值。
    state.metrics = metricsOf({ requests_total: 140, errors_total: 70 });
    const second = await runNotificationChecks(service);
    expect(second.triggered).toContain("http.error_rate");
    const outcome = second.outcomes.find((o) => o.eventKey === "http.error_rate");
    expect(outcome?.fields).toContainEqual({ label: "区间请求数", value: "40" });
  });

  it("ignores request volume below the minimum sample size", async () => {
    const { service } = stubService({
      "http.error_rate": { thresholds: { minRequests: 100 } },
    });
    state.metrics = metricsOf({ requests_total: 10, errors_total: 0 });
    await runNotificationChecks(service);

    // 5 次请求全 5xx，但样本量不足 100，不该告警。
    state.metrics = metricsOf({ requests_total: 15, errors_total: 5 });
    const report = await runNotificationChecks(service);
    expect(report.triggered).not.toContain("http.error_rate");
  });

  it("treats a restarted counter as a fresh window instead of a negative delta", async () => {
    const { service } = stubService({ "db.busy": {} });
    state.metrics = metricsOf({ sqlite_busy_total: 100 });
    await runNotificationChecks(service);

    // 计数器归零说明进程重启过，增量应取新值本身（3 次）。
    state.metrics = metricsOf({ sqlite_busy_total: 3 });
    const report = await runNotificationChecks(service);
    const outcome = report.outcomes.find((o) => o.eventKey === "db.busy");
    expect(outcome?.detail).toBe("区间 3 次 SQLITE_BUSY");
    expect(report.triggered).not.toContain("db.busy");
  });

  it("reports a failed integrity check as a critical alert", async () => {
    state.sqlite = fakeSqlite({ quickCheck: "database disk image is malformed" });
    const { service } = stubService({});

    const report = await runNotificationChecks(service);

    expect(report.triggered).toContain("site.health");
    const outcome = report.outcomes.find((o) => o.eventKey === "site.health");
    expect(outcome?.level).toBe("critical");
    expect(outcome?.body).toContain("malformed");
  });

  it("counts only pending friend links for the review alert", async () => {
    state.sqlite = fakeSqlite({ pendingFriendLinks: 2 });
    const { service } = stubService({ "content.pending": {} });

    const report = await runNotificationChecks(service);

    expect(report.triggered).toContain("content.pending");
    const outcome = report.outcomes.find((o) => o.eventKey === "content.pending");
    expect(outcome?.body).toContain("2 条友链申请");
  });

  it("keeps a failing check from taking down the whole round", async () => {
    state.sqlite = {
      prepare() {
        throw new Error("database is closed");
      },
      pragma: () => [],
    };
    const { service } = stubService({ "content.pending": {} });

    const report = await runNotificationChecks(service);

    // 健康检查与友链统计都读 SQLite，两个都应各自降级而不是整轮抛错。
    const health = report.outcomes.find((o) => o.eventKey === "site.health");
    expect(health?.triggered).toBe(true);
    expect(health?.body).toContain("database is closed");

    const pending = report.outcomes.find((o) => o.eventKey === "content.pending");
    expect(pending?.triggered).toBe(false);
    expect(pending?.detail).toContain("统计失败");
    // 两个检查都在内部吞掉了异常，所以整轮不该出现未捕获错误。
    expect(report.errors).toEqual([]);
  });

  it("records a delivery failure without aborting the remaining events", async () => {
    state.metrics = metricsOf({
      backups: {
        dir: "/data/backups",
        count: 0,
        uploads_archives: 0,
        total_bytes: 0,
        latest_file: null,
        latest_age_s: null,
      },
    });
    state.sqlite = fakeSqlite({ pendingFriendLinks: 1 });
    const { service } = stubService({
      "backup.stale": {},
      "content.pending": {},
    });
    service.notify = async () => {
      throw new Error("telegram 502");
    };

    const report = await runNotificationChecks(service);

    expect(report.triggered).toEqual(
      expect.arrayContaining(["backup.stale", "content.pending"]),
    );
    expect(report.errors.filter((line) => line.includes("telegram 502"))).toHaveLength(
      2,
    );
  });

  it("skips events that have no rule row", async () => {
    const { service } = stubService({});

    const report = await runNotificationChecks(service);

    const keys = report.outcomes.map((outcome) => outcome.eventKey);
    expect(keys).not.toContain("backup.stale");
    expect(keys).not.toContain("content.pending");
    // 健康检查没有阈值，也不依赖规则行。
    expect(keys).toContain("site.health");
  });
});
