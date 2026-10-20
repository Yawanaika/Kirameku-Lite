import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../server/db/open";

interface BackupFile {
  file: string;
  date: Date;
}

function backupTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function parseBackupFile(file: string): Date | null {
  const match = /^kirameku-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.db$/.exec(
    file,
  );
  if (!match) return null;
  const [, day, hour, minute, second, millisecond] = match;
  return new Date(`${day}T${hour}:${minute}:${second}.${millisecond}Z`);
}

function isoWeekKey(date: Date): string {
  const value = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function listBackups(directory: string): BackupFile[] {
  return fs
    .readdirSync(directory)
    .map((file) => ({ file, date: parseBackupFile(file) }))
    .filter((entry): entry is BackupFile => entry.date !== null)
    .sort((left, right) => right.date.getTime() - left.date.getTime());
}

function pruneBackups(directory: string): number {
  const backups = listBackups(directory);
  const dailyCutoff = Date.now() - 14 * 86_400_000;
  const keep = new Set<string>();

  for (const backup of backups) {
    if (backup.date.getTime() >= dailyCutoff) keep.add(backup.file);
  }

  const weekly = new Map<string, BackupFile>();
  for (const backup of backups) {
    if (backup.date.getTime() >= dailyCutoff) continue;
    const key = isoWeekKey(backup.date);
    if (!weekly.has(key)) weekly.set(key, backup);
  }

  for (const backup of [...weekly.values()]
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .slice(0, 8)) {
    keep.add(backup.file);
  }

  let removed = 0;
  for (const backup of backups) {
    if (keep.has(backup.file)) continue;
    fs.rmSync(path.join(directory, backup.file), { force: true });
    fs.rmSync(path.join(directory, `${backup.file}.meta.json`), {
      force: true,
    });
    removed++;
  }
  return removed;
}

async function main() {
  const sourcePath = path.resolve(
    process.env.DATABASE_PATH || "./data/kirameku.db",
  );
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Database not found: ${sourcePath}`);
  }

  const backupDir = path.resolve(process.env.BACKUP_DIR || "./backups");
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });

  const createdAt = new Date();
  const destination = path.join(
    backupDir,
    `kirameku-${backupTimestamp(createdAt)}.db`,
  );

  const source = openDatabase(sourcePath, {
    readonly: true,
    fileMustExist: true,
  });

  try {
    await source.backup(destination);
    // The backup contains password hashes and visitor PII; keep it private.
    fs.chmodSync(destination, 0o600);
  } finally {
    source.close();
  }

  const backup = openDatabase(destination, {
    readonly: true,
    fileMustExist: true,
  });

  let integrityOk = false;
  let foreignKeyViolations = 0;
  let migration: string | null = null;

  try {
    const integrity = backup.pragma("integrity_check") as Array<{
      integrity_check: string;
    }>;
    integrityOk =
      integrity.length === 1 && integrity[0]?.integrity_check === "ok";
    foreignKeyViolations = (
      backup.prepare("PRAGMA foreign_key_check").all() as unknown[]
    ).length;

    try {
      const row = backup
        .prepare(
          'SELECT "filename" FROM "__migrations" ORDER BY "applied_at" DESC, "filename" DESC LIMIT 1',
        )
        .get() as { filename: string } | undefined;
      migration = row?.filename ?? null;
    } catch {
      migration = null;
    }
  } finally {
    backup.close();
  }

  // Read-only verification can create empty WAL/SHM sidecars. The backup
  // itself is standalone; remove the sidecars so retention only sees .db files.
  for (const suffix of ["-wal", "-shm"]) {
    fs.rmSync(`${destination}${suffix}`, { force: true });
  }

  const size = fs.statSync(destination).size;
  const sha256 = crypto
    .createHash("sha256")
    .update(fs.readFileSync(destination))
    .digest("hex");

  const metadata = {
    file: path.basename(destination),
    createdAt: createdAt.toISOString(),
    size,
    sha256,
    migration,
    integrityOk,
    foreignKeyViolations,
  };

  fs.writeFileSync(
    `${destination}.meta.json`,
    `${JSON.stringify(metadata, null, 2)}\n`,
    { mode: 0o600 },
  );

  console.log(`backup: ${destination}`);
  console.log(`size: ${size} bytes`);
  console.log(`sha256: ${sha256}`);
  console.log(`migration: ${migration ?? "unknown"}`);
  console.log(`integrity_check: ${integrityOk ? "ok" : "FAILED"}`);
  console.log(`foreign_key_check: ${foreignKeyViolations} violation(s)`);

  if (!integrityOk || foreignKeyViolations > 0) {
    process.exitCode = 1;
    return;
  }

  if (process.argv.includes("--prune")) {
    const removed = pruneBackups(backupDir);
    console.log(`pruned ${removed} old backup(s)`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
