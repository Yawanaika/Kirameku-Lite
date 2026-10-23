import { getSqlite } from "@/server/db/client";
import { getMetrics } from "@/server/http/metrics";
import type { NotificationLevel } from "./contracts";
import type { NotificationsService, RuleRuntimeState } from "./service";

/** One evaluated alert, whether or not it crossed the threshold. */
export interface CheckOutcome {
  eventKey: string;
  triggered: boolean;
  level: NotificationLevel;
  title: string;
  body: string;
  fields: { label: string; value: string }[];
  /** Short human-readable evaluation note, for logs and debugging. */
  detail: string;
}

export interface CheckReport {
  ran_at: string;
  outcomes: CheckOutcome[];
  /** Events that crossed their threshold in this tick. */
  triggered: string[];
  errors: string[];
}

interface CounterBaseline {
  at: number;
  requests: number;
  errors: number;
  notFound: number;
  busy: number;
}

/**
 * The metrics store only exposes cumulative counters, so HTTP checks compare
 * against the previous tick. The baseline is in memory: after a restart the
 * first tick just records a fresh baseline.
 */
let baseline: CounterBaseline | null = null;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function gb(bytes: number | null | undefined): string {
  if (typeof bytes !== "number") return "未知";
  return `${round(bytes / 1024 / 1024 / 1024)} GB`;
}

function hours(seconds: number): string {
  return `${round(seconds / 3600)} 小时`;
}

function pendingContent() {
  const database = getSqlite();
  const count = (sql: string, ...params: string[]) =>
    Number((database.prepare(sql).get(...params) as { total: number }).total);

  const comments = count(
    `SELECT count(*) AS total FROM "comment" WHERE "status" = ?`,
    "pending",
  );
  const messages = count(
    `SELECT count(*) AS total FROM "message" WHERE "status" = ?`,
    "pending",
  );
  const friendLinks = count(
    `SELECT count(*) AS total FROM "friend_link" WHERE "is_approved" = 0`,
  );

  return {
    comments,
    messages,
    friendLinks,
    total: comments + messages + friendLinks,
  };
}

function checkBackupStale(state: RuleRuntimeState): CheckOutcome {
  const maxAgeHours = state.thresholds.maxAgeHours ?? 30;
  const metrics = getMetrics();
  const latestAge = metrics.backups.latest_age_s;

  const base: CheckOutcome = {
    eventKey: "backup.stale",
    triggered: false,
    level: "critical",
    title: "备份已过期",
    body: "",
    fields: [],
    detail: "备份正常",
  };

  if (latestAge === null) {
    return {
      ...base,
      triggered: true,
      body: `备份目录 ${metrics.backups.dir} 里没有任何备份文件，请检查 scripts/maintenance.sh 有没有被执行。`,
      fields: [{ label: "备份目录", value: metrics.backups.dir }],
      detail: "没有备份文件",
    };
  }

  if (latestAge <= maxAgeHours * 3600) {
    return { ...base, detail: `最新备份 ${hours(latestAge)} 前` };
  }

  return {
    ...base,
    triggered: true,
    body: `最新备份已经是 ${hours(latestAge)} 前了，超过 ${maxAgeHours} 小时的阈值。通常是 systemd timer 没有触发或维护脚本报错。`,
    fields: [
      { label: "最新备份", value: metrics.backups.latest_file ?? "无" },
      { label: "距今", value: hours(latestAge) },
      { label: "阈值", value: `${maxAgeHours} 小时` },
      { label: "备份数量", value: String(metrics.backups.count) },
    ],
    detail: `最新备份 ${hours(latestAge)} 前`,
  };
}

function checkDiskLow(state: RuleRuntimeState): CheckOutcome {
  const minFreeGb = state.thresholds.minFreeGb ?? 2;
  const metrics = getMetrics();
  const disk = metrics.disk;

  const base: CheckOutcome = {
    eventKey: "disk.low",
    triggered: false,
    level: "critical",
    title: "磁盘空间不足",
    body: "",
    fields: [],
    detail: "磁盘空间充足",
  };

  if (!disk) return { ...base, detail: "无法读取磁盘信息" };

  const availableGb = disk.available_bytes / 1024 / 1024 / 1024;
  if (availableGb >= minFreeGb) {
    return { ...base, detail: `可用 ${gb(disk.available_bytes)}` };
  }

  return {
    ...base,
    triggered: true,
    body: `数据库所在分区只剩 ${gb(disk.available_bytes)} 可用空间（低于 ${minFreeGb} GB）。SQLite 写入、WAL 与备份都可能失败，请尽快清理或扩容。`,
    fields: [
      { label: "分区路径", value: disk.path },
      { label: "可用空间", value: gb(disk.available_bytes) },
      { label: "总容量", value: gb(disk.total_bytes) },
      { label: "阈值", value: `${minFreeGb} GB` },
    ],
    detail: `可用 ${gb(disk.available_bytes)}`,
  };
}

function counterDelta(current: number, previous: number): number {
  // A smaller value than the baseline means the process restarted.
  return current >= previous ? current - previous : current;
}

function checkHttpRates(
  errorState: RuleRuntimeState,
  notFoundState: RuleRuntimeState,
  metrics: ReturnType<typeof getMetrics>,
  previous: CounterBaseline | null,
): { error: CheckOutcome; notFound: CheckOutcome } {
  const now: CounterBaseline = {
    at: Date.now(),
    requests: metrics.requests_total,
    errors: metrics.errors_total,
    notFound: metrics.requests_by_status["404"] ?? 0,
    busy: metrics.sqlite_busy_total,
  };

  const errorBase: CheckOutcome = {
    eventKey: "http.error_rate",
    triggered: false,
    level: "warning",
    title: "接口错误率过高",
    body: "",
    fields: [],
    detail: "错误率正常",
  };
  const notFoundBase: CheckOutcome = {
    eventKey: "http.not_found_burst",
    triggered: false,
    level: "warning",
    title: "404 请求激增",
    body: "",
    fields: [],
    detail: "404 正常",
  };

  if (!previous) {
    return {
      error: { ...errorBase, detail: "已建立计数器基线" },
      notFound: { ...notFoundBase, detail: "已建立计数器基线" },
    };
  }

  const requests = counterDelta(now.requests, previous.requests);
  const errors = counterDelta(now.errors, previous.errors);
  const notFoundCount = counterDelta(now.notFound, previous.notFound);
  const windowSeconds = Math.max(1, Math.round((now.at - previous.at) / 1000));

  const minErrorRequests = errorState.thresholds.minRequests ?? 20;
  const maxErrorPercent = errorState.thresholds.maxErrorPercent ?? 5;
  const minNotFoundRequests = notFoundState.thresholds.minRequests ?? 20;
  const maxNotFoundPercent =
    notFoundState.thresholds.maxNotFoundPercent ?? 40;

  let error: CheckOutcome = {
    ...errorBase,
    detail: `区间 ${requests} 次请求，${errors} 个 5xx`,
  };
  if (requests >= minErrorRequests) {
    const percent = (errors / requests) * 100;
    if (percent > maxErrorPercent) {
      error = {
        ...error,
        triggered: true,
        body: `最近 ${windowSeconds} 秒内 ${requests} 次请求中有 ${errors} 次 5xx，错误率 ${round(percent)}%，超过 ${maxErrorPercent}% 阈值。`,
        fields: [
          { label: "区间请求数", value: String(requests) },
          { label: "5xx 次数", value: String(errors) },
          { label: "错误率", value: `${round(percent)}%` },
          { label: "阈值", value: `${maxErrorPercent}%` },
        ],
      };
    }
  }

  let notFoundResult: CheckOutcome = {
    ...notFoundBase,
    detail: `区间 ${requests} 次请求，${notFoundCount} 个 404`,
  };
  if (requests >= minNotFoundRequests) {
    const percent = (notFoundCount / requests) * 100;
    if (percent > maxNotFoundPercent) {
      notFoundResult = {
        ...notFoundResult,
        triggered: true,
        body: `最近 ${windowSeconds} 秒内 ${requests} 次请求中有 ${notFoundCount} 次 404（${round(percent)}%），超过 ${maxNotFoundPercent}% 阈值。常见原因：前端请求了不存在的接口、资源路径被改坏，或有人在扫站。`,
        fields: [
          { label: "区间请求数", value: String(requests) },
          { label: "404 次数", value: String(notFoundCount) },
          { label: "占比", value: `${round(percent)}%` },
          { label: "阈值", value: `${maxNotFoundPercent}%` },
        ],
      };
    }
  }

  return { error, notFound: notFoundResult };
}

function checkDbBusy(
  state: RuleRuntimeState,
  metrics: ReturnType<typeof getMetrics>,
  previous: CounterBaseline | null,
): CheckOutcome {
  const maxBusy = state.thresholds.maxBusy ?? 5;
  const base: CheckOutcome = {
    eventKey: "db.busy",
    triggered: false,
    level: "warning",
    title: "数据库锁等待偏多",
    body: "",
    fields: [],
    detail: "数据库锁等待正常",
  };

  if (!previous) return { ...base, detail: "已建立计数器基线" };

  const busy = counterDelta(metrics.sqlite_busy_total, previous.busy);
  if (busy <= maxBusy) {
    return { ...base, detail: `区间 ${busy} 次 SQLITE_BUSY` };
  }

  return {
    ...base,
    triggered: true,
    body: `最近一段时间 SQLite 返回了 ${busy} 次 BUSY/LOCKED（阈值 ${maxBusy}），写入会被拖慢。请检查是否有长事务，或备份与写入在互相争抢。`,
    fields: [
      { label: "区间次数", value: String(busy) },
      { label: "阈值", value: String(maxBusy) },
      { label: "累计次数", value: String(metrics.sqlite_busy_total) },
    ],
    detail: `区间 ${busy} 次 SQLITE_BUSY`,
  };
}

function checkSiteHealth(): CheckOutcome {
  const base: CheckOutcome = {
    eventKey: "site.health",
    triggered: false,
    level: "critical",
    title: "站点健康检查失败",
    body: "",
    fields: [],
    detail: "数据库可读",
  };

  try {
    const database = getSqlite();
    database.prepare("SELECT 1").get();
    const integrity = database.pragma("quick_check(1)") as Array<{
      quick_check: string;
    }>;
    const result = integrity[0]?.quick_check ?? "unknown";
    if (result !== "ok") {
      return {
        ...base,
        triggered: true,
        body: `SQLite 完整性检查返回：${result}。请立刻检查数据库文件与磁盘。`,
        fields: [{ label: "quick_check", value: result }],
        detail: `quick_check: ${result}`,
      };
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      triggered: true,
      body: `进程内健康检查抛出异常：${reason}`,
      fields: [{ label: "错误", value: reason.slice(0, 300) }],
      detail: reason.slice(0, 120),
    };
  }

  return base;
}

function checkContentPending(state: RuleRuntimeState): CheckOutcome {
  const minCount = state.thresholds.minCount ?? 1;
  const base: CheckOutcome = {
    eventKey: "content.pending",
    triggered: false,
    level: "info",
    title: "有待审核内容",
    body: "",
    fields: [],
    detail: "没有待审核内容",
  };

  let counts: ReturnType<typeof pendingContent>;
  try {
    counts = pendingContent();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ...base, detail: `统计失败：${reason.slice(0, 80)}` };
  }

  if (counts.total < minCount) {
    return { ...base, detail: `待审核 ${counts.total} 条` };
  }

  return {
    ...base,
    triggered: true,
    body: `当前有 ${counts.total} 条内容等待审核，去后台处理一下吧。`,
    fields: [
      { label: "待审核评论", value: String(counts.comments) },
      { label: "待审核留言", value: String(counts.messages) },
      { label: "友链申请", value: String(counts.friendLinks) },
      { label: "触发阈值", value: String(minCount) },
    ],
    detail: `待审核 ${counts.total} 条`,
  };
}

/**
 * Evaluate every alert that has a rule, then hand the triggered ones to the
 * notification service (which owns the cooldown and the delivery log).
 */
export async function runNotificationChecks(
  service: NotificationsService,
): Promise<CheckReport> {
  const outcomes: CheckOutcome[] = [];
  const errors: string[] = [];

  const fallback = (eventKey: string): RuleRuntimeState => ({
    enabled: true,
    channels: [],
    thresholds: {},
    cooldownSeconds: 0,
  });

  const [errorState, notFoundState, busyState, backupState, diskState, pendingState] =
    await Promise.all([
      service.getRuleState("http.error_rate"),
      service.getRuleState("http.not_found_burst"),
      service.getRuleState("db.busy"),
      service.getRuleState("backup.stale"),
      service.getRuleState("disk.low"),
      service.getRuleState("content.pending"),
    ]);

  const metrics = getMetrics();
  const previous = baseline;

  const guarded = (eventKey: string, run: () => CheckOutcome): void => {
    try {
      outcomes.push(run());
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      errors.push(`${eventKey}: ${reason}`);
    }
  };

  try {
    const pair = checkHttpRates(
      errorState ?? fallback("http.error_rate"),
      notFoundState ?? fallback("http.not_found_burst"),
      metrics,
      previous,
    );
    outcomes.push(pair.error, pair.notFound);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    errors.push(`http checks: ${reason}`);
  }

  baseline = {
    at: Date.now(),
    requests: metrics.requests_total,
    errors: metrics.errors_total,
    notFound: metrics.requests_by_status["404"] ?? 0,
    busy: metrics.sqlite_busy_total,
  };

  if (backupState) guarded("backup.stale", () => checkBackupStale(backupState));
  if (diskState) guarded("disk.low", () => checkDiskLow(diskState));
  if (busyState) guarded("db.busy", () => checkDbBusy(busyState, metrics, previous));
  guarded("site.health", () => checkSiteHealth());
  if (pendingState) {
    guarded("content.pending", () => checkContentPending(pendingState));
  }

  const triggered: string[] = [];
  for (const outcome of outcomes) {
    if (!outcome.triggered) continue;
    triggered.push(outcome.eventKey);
    try {
      await service.notify({
        eventKey: outcome.eventKey,
        level: outcome.level,
        title: outcome.title,
        body: outcome.body,
        fields: outcome.fields,
        force: false,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      errors.push(`${outcome.eventKey} notify: ${reason}`);
    }
  }

  return { ran_at: new Date().toISOString(), outcomes, triggered, errors };
}

/** Reset the in-memory counter baseline (used by tests). */
export function resetCheckBaseline(): void {
  baseline = null;
}
