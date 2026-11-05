/** 备份文件的三类产物，与 scripts/backup-db.ts 的文件名约定一致。 */
export type BackupFileKind = "database" | "metadata" | "uploads";

export interface BackupGroup {
  /** 文件名里的时间戳，同一组内三个文件共用。 */
  stamp: string;
  /** 该组备份的生成时间（ISO 8601）。 */
  createdAt: string;
  /** 距今秒数，用于判断快照是否新鲜。 */
  ageSeconds: number;
  database: string | null;
  databaseBytes: number | null;
  uploads: string | null;
  uploadsBytes: number | null;
  metadata: string | null;
  totalBytes: number;
}

export interface BackupCounts {
  /** 备份组数（一次备份任务产生一组）。 */
  groups: number;
  databases: number;
  uploadsArchives: number;
}

export interface BackupRetention {
  /** 最近这些天内的备份全部保留。 */
  dailyDays: number;
  /** 更早的备份按 ISO 周各保留一份，最多保留这么多周。 */
  weeklyCount: number;
}

export interface BackupOverview {
  dir: string;
  /** 备份目录不存在或不可读；此时 groups 为空。 */
  unreadable: boolean;
  groups: BackupGroup[];
  counts: BackupCounts;
  totalBytes: number;
  latestFile: string | null;
  latestAgeSeconds: number | null;
  /** 超过这个小时数没有新备份就视为过期，与预警通知的默认阈值一致。 */
  staleAfterHours: number;
  stale: boolean;
  disk: {
    path: string;
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
  } | null;
  retention: BackupRetention;
}

/**
 * `/api/internal/metrics` 只需要计数与新鲜度。
 *
 * 字段名保持 snake_case：它已经是对外承诺的监控契约（Cron、探针、通知巡检
 * 都按这些名字读），后台面板用的是上面的 `BackupOverview`。
 */
export interface BackupSummary {
  dir: string;
  count: number;
  uploads_archives: number;
  total_bytes: number;
  latest_file: string | null;
  latest_age_s: number | null;
}
