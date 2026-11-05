import "server-only";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/server/env";
import { readDiskUsage } from "@/server/storage/disk";
import type {
  BackupCounts,
  BackupFileKind,
  BackupGroup,
  BackupOverview,
  BackupSummary,
} from "./contracts";

/**
 * 备份目录里只有 scripts/backup-db.ts 写出的三种文件共享同一个时间戳：
 *
 *   kirameku-<ts>.db              SQLite 快照
 *   kirameku-<ts>.db.meta.json    校验和与完整性元数据
 *   kirameku-<ts>-uploads.tar.gz  上传图片归档（没有图片时不存在）
 *
 * 这里只读、从不删除或恢复：恢复要停服，仍留在 CLI（pnpm db:restore）。
 */
const FILE_PATTERN =
  /^(kirameku-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)(\.db\.meta\.json|\.db|-uploads\.tar\.gz)$/;

/** 超过这么久没有新的数据库快照就标红，与通知巡检的默认阈值一致。 */
export const DEFAULT_STALE_HOURS = 30;

/** 保留策略（与 scripts/backup-db.ts 的 pruneBackups 保持一致）。 */
export const DAILY_RETENTION_DAYS = 14;
export const WEEKLY_RETENTION_COUNT = 8;

interface ParsedFile {
  stamp: string;
  date: Date;
  kind: BackupFileKind;
}

function parseFileName(name: string): ParsedFile | null {
  const match = FILE_PATTERN.exec(name);
  if (!match) return null;

  const [, stamp, suffix] = match;
  // 文件名用 - 代替 : 和 . 以便排序，这里还原成 ISO 再解析。
  const iso = stamp
    .slice("kirameku-".length)
    .replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const kind: BackupFileKind =
    suffix === ".db"
      ? "database"
      : suffix === "-uploads.tar.gz"
        ? "uploads"
        : "metadata";

  return { stamp, date, kind };
}

/** 备份目录；BACKUP_DIR 未配置时与脚本一样落在 ./backups。 */
export function resolveBackupDir(): string {
  return path.resolve(env.BACKUP_DIR || "./backups");
}

/** 数据库文件所在目录，用来读磁盘余量。 */
function databaseDir(): string {
  return path.dirname(path.resolve(env.DATABASE_PATH));
}

export function readBackupOverview(dir: string = resolveBackupDir()): BackupOverview {
  const now = Date.now();
  const groups = new Map<
    string,
    { date: Date; database: string | null; databaseBytes: number | null; uploads: string | null; uploadsBytes: number | null; metadata: string | null; totalBytes: number }
  >();
  let unreadable = false;

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    unreadable = true;
  }

  for (const name of entries) {
    const parsed = parseFileName(name);
    if (!parsed) continue;

    let stat: fs.Stats;
    try {
      stat = fs.statSync(path.join(dir, name));
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    let group = groups.get(parsed.stamp);
    if (!group) {
      group = {
        date: parsed.date,
        database: null,
        databaseBytes: null,
        uploads: null,
        uploadsBytes: null,
        metadata: null,
        totalBytes: 0,
      };
      groups.set(parsed.stamp, group);
    }

    group.totalBytes += stat.size;
    if (parsed.kind === "database") {
      group.database = name;
      group.databaseBytes = stat.size;
    } else if (parsed.kind === "uploads") {
      group.uploads = name;
      group.uploadsBytes = stat.size;
    } else {
      group.metadata = name;
    }
  }

  const items: BackupGroup[] = [...groups.entries()]
    .map(([stamp, group]) => ({
      stamp,
      createdAt: group.date.toISOString(),
      // 时钟漂移时文件名可能落在未来，按 0 处理而不是显示负数。
      ageSeconds: Math.max(0, Math.round((now - group.date.getTime()) / 1000)),
      database: group.database,
      databaseBytes: group.databaseBytes,
      uploads: group.uploads,
      uploadsBytes: group.uploadsBytes,
      metadata: group.metadata,
      totalBytes: group.totalBytes,
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  // 新鲜度只看数据库快照：只有图片归档时数据本身仍然没有备份，
  // 不能让一个很新的 tar.gz 把「没有快照」伪装成正常。
  const newestSnapshot = items.find((item) => item.database !== null) ?? null;
  const counts: BackupCounts = {
    groups: items.length,
    databases: items.filter((item) => item.database !== null).length,
    uploadsArchives: items.filter((item) => item.uploads !== null).length,
  };
  const latestAgeSeconds = newestSnapshot ? newestSnapshot.ageSeconds : null;

  return {
    dir,
    unreadable,
    groups: items,
    counts,
    totalBytes: items.reduce((sum, item) => sum + item.totalBytes, 0),
    latestFile:
      newestSnapshot?.database ?? items[0]?.uploads ?? items[0]?.database ?? null,
    latestAgeSeconds,
    staleAfterHours: DEFAULT_STALE_HOURS,
    stale:
      unreadable ||
      latestAgeSeconds === null ||
      latestAgeSeconds > DEFAULT_STALE_HOURS * 3600,
    disk: readDiskUsage(databaseDir()),
    retention: {
      dailyDays: DAILY_RETENTION_DAYS,
      weeklyCount: WEEKLY_RETENTION_COUNT,
    },
  };
}

/** `/api/internal/metrics` 的备份字段：只保留计数与新鲜度。 */
export function summarizeBackups(dir: string = resolveBackupDir()): BackupSummary {
  const overview = readBackupOverview(dir);
  return {
    dir: overview.dir,
    count: overview.counts.databases,
    uploads_archives: overview.counts.uploadsArchives,
    total_bytes: overview.totalBytes,
    latest_file: overview.latestFile,
    latest_age_s: overview.latestAgeSeconds,
  };
}
