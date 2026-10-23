import type { NotificationLevel } from "./contracts";

export interface ThresholdSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  help?: string;
}

export interface EventSpec {
  key: string;
  label: string;
  description: string;
  level: NotificationLevel;
  /** Minimum seconds between two deliveries of the same event. */
  cooldownSeconds: number;
  thresholds: ThresholdSpec[];
}

/**
 * Every alert the app can send. The admin UI renders the rule editor from this
 * list, so adding a new check only needs an entry here plus the evaluation in
 * checks.ts.
 */
export const NOTIFICATION_EVENTS: EventSpec[] = [
  {
    key: "backup.stale",
    label: "备份过期",
    description:
      "每日维护没有按时产出备份（最新快照太旧），通常意味着 systemd timer 或维护脚本挂了。",
    level: "critical",
    cooldownSeconds: 3600,
    thresholds: [
      {
        key: "maxAgeHours",
        label: "最大间隔（小时）",
        min: 1,
        max: 720,
        step: 1,
        default: 30,
        help: "最新备份距今超过这个小时数即告警。每日备份建议 30。",
      },
    ],
  },
  {
    key: "disk.low",
    label: "磁盘空间不足",
    description: "数据库所在分区可用空间低于阈值，SQLite 写入与备份都会失败。",
    level: "critical",
    cooldownSeconds: 3600,
    thresholds: [
      {
        key: "minFreeGb",
        label: "最少剩余（GB）",
        min: 0.1,
        max: 1024,
        step: 0.1,
        default: 2,
        help: "可用空间低于该值时告警。",
      },
    ],
  },
  {
    key: "http.error_rate",
    label: "接口错误率过高",
    description: "巡检区间内 5xx 响应占比超过阈值，说明服务端在抛异常。",
    level: "warning",
    cooldownSeconds: 1800,
    thresholds: [
      {
        key: "maxErrorPercent",
        label: "错误率阈值（%）",
        min: 1,
        max: 100,
        step: 1,
        default: 5,
      },
      {
        key: "minRequests",
        label: "最少请求数",
        min: 1,
        max: 10_000,
        step: 1,
        default: 20,
        help: "区间内请求太少时不判定，避免误报。",
      },
    ],
  },
  {
    key: "http.not_found_burst",
    label: "404 激增",
    description:
      "大量 404 往往意味着前端请求了不存在的 API、静态资源路径被改坏或有人在扫站。",
    level: "warning",
    cooldownSeconds: 1800,
    thresholds: [
      {
        key: "maxNotFoundPercent",
        label: "404 占比阈值（%）",
        min: 1,
        max: 100,
        step: 1,
        default: 40,
      },
      {
        key: "minRequests",
        label: "最少请求数",
        min: 1,
        max: 10_000,
        step: 1,
        default: 20,
      },
    ],
  },
  {
    key: "db.busy",
    label: "数据库锁等待",
    description:
      "SQLite 返回 SQLITE_BUSY/LOCKED 的次数偏多，写入会被拖慢甚至失败。",
    level: "warning",
    cooldownSeconds: 1800,
    thresholds: [
      {
        key: "maxBusy",
        label: "区间内最多次数",
        min: 1,
        max: 10_000,
        step: 1,
        default: 5,
      },
    ],
  },
  {
    key: "site.health",
    label: "站点健康检查失败",
    description:
      "进程内健康检查（数据库读写）失败，站点很可能已经不可用。注意：进程整体挂掉时本进程无法报警，建议另外配一个外部探针调用 /api/internal/notify。",
    level: "critical",
    cooldownSeconds: 900,
    thresholds: [],
  },
  {
    key: "content.pending",
    label: "待审核内容堆积",
    description: "有新的评论 / 留言 / 友链申请等待站长审核。",
    level: "info",
    cooldownSeconds: 21_600,
    thresholds: [
      {
        key: "minCount",
        label: "触发条数",
        min: 1,
        max: 10_000,
        step: 1,
        default: 1,
        help: "待审核总数达到该值才通知。",
      },
    ],
  },
  {
    key: "message.created",
    label: "收到新留言",
    description: "有新留言或回复提交时立即发送通知。",
    level: "info",
    cooldownSeconds: 0,
    thresholds: [],
  },
];

export function getEventSpec(eventKey: string): EventSpec | undefined {
  return NOTIFICATION_EVENTS.find((event) => event.key === eventKey);
}

/** Merge catalog defaults with the values stored on the rule row. */
export function resolveThresholds(
  spec: EventSpec,
  settings: Record<string, number>,
): Record<string, number> {
  const resolved: Record<string, number> = {};
  for (const threshold of spec.thresholds) {
    const stored = settings[threshold.key];
    resolved[threshold.key] =
      typeof stored === "number" && Number.isFinite(stored)
        ? Math.min(threshold.max, Math.max(threshold.min, stored))
        : threshold.default;
  }
  return resolved;
}
