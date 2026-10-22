import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../server/db/open";

/**
 * A backup is a *group* of files that share one timestamp:
 *
 *   kirameku-<ts>.db               SQLite snapshot
 *   kirameku-<ts>.db.meta.json     checksum + integrity metadata
 *   kirameku-<ts>-uploads.tar.gz   uploaded images (skipped when there are none)
 *
 * Retention works on groups so a pruned backup never leaves a stray .db or tar
 * behind, and a restore can find the matching uploads archive by name.
 */
interface BackupGroup {
  stamp: string;
  date: Date;
  files: string[];
}

const STAMP_PATTERN =
  /^(kirameku-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)(?:\.db|\.db\.meta\.json|-uploads\.tar\.gz)$/;

function backupTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function parseStamp(file: string): { stamp: string; date: Date } | null {
  const match = STAMP_PATTERN.exec(file);
  if (!match) return null;

  const stamp = match[1];
  const raw = stamp.slice("kirameku-".length);
  const day = raw.slice(0, 10);
  const hour = raw.slice(11, 13);
  const minute = raw.slice(14, 16);
  const second = raw.slice(17, 19);
  const millisecond = raw.slice(20, 23);
  const date = new Date(`${day}T${hour}:${minute}:${second}.${millisecond}Z`);
  return Number.isNaN(date.getTime()) ? null : { stamp, date };
}

function listGroups(directory: string): BackupGroup[] {
  const groups = new Map<string, BackupGroup>();

  for (const file of fs.readdirSync(directory)) {
    const parsed = parseStamp(file);
    if (!parsed) continue;

    const existing = groups.get(parsed.stamp);
    if (existing) {
      existing.files.push(file);
    } else {
      groups.set(parsed.stamp, {
        stamp: parsed.stamp,
        date: parsed.date,
        files: [file],
      });
    }
  }

  return [...groups.values()].sort(
    (left, right) => right.date.getTime() - left.date.getTime(),
  );
}

function isoWeekKey(date: Date): string {
  const value = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(value.getUTCFullYear(), 0, 1);
  const week = Math.ceil(
    ((value.getTime() - yearStart) / 86_400_000 + 1) / 7,
  );
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Keep every backup from the last 14 days, then one per ISO week for the eight
 * most recent weeks. Everything else is deleted as a whole group.
 */
function pruneBackups(directory: string): number {
  const groups = listGroups(directory);
  const dailyCutoff = Date.now() - 14 * 86_400_000;
  const keep = new Set<string>();

  for (const group of groups) {
    if (group.date.getTime() >= dailyCutoff) keep.add(group.stamp);
  }

  const weekly = new Map<string, BackupGroup>();
  for (const group of groups) {
    if (group.date.getTime() >= dailyCutoff) continue;
    const key = isoWeekKey(group.date);
    if (!weekly.has(key)) weekly.set(key, group);
  }

  for (const group of [...weekly.values()]
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .slice(0, 8)) {
    keep.add(group.stamp);
  }

  let removed = 0;
  for (const group of groups) {
    if (keep.has(group.stamp)) continue;
    for (const file of group.files) {
      fs.rmSync(path.join(directory, file), { force: true });
      removed++;
    }
  }
  return removed;
}

function sha256File(file: string): string {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(file, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let read = 0;
    while ((read = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function tarFailure(result: ReturnType<typeof spawnSync>): string {
  if (result.error) return result.error.message;
  return `tar exited with ${result.status ?? "unknown"}: ${String(result.stderr ?? "").trim()}`;
}

interface UploadsBackup {
  file: string;
  size: number;
  sha256: string;
  entries: number;
}

/**
 * Archive UPLOAD_DIR into the same timestamped group as the database. Uploads
 * are not in SQLite, so a database-only backup restores a site whose images all
 * 404. Returns null when there is nothing to archive.
 */
function backupUploads(
  uploadDir: string,
  destination: string,
): UploadsBackup | null {
  if (!fs.existsSync(uploadDir)) {
    console.log(`uploads: no directory at ${uploadDir}, skipped`);
    return null;
  }

  if (fs.readdirSync(uploadDir).length === 0) {
    console.log("uploads: directory is empty, skipped");
    return null;
  }

  const created = spawnSync(
    "tar",
    ["-czf", destination, "-C", uploadDir, "."],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  if (created.status !== 0) {
    throw new Error(`uploads backup failed: ${tarFailure(created)}`);
  }

  const listed = spawnSync("tar", ["-tzf", destination], {
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (listed.status !== 0) {
    throw new Error(
      `uploads backup verification failed: ${tarFailure(listed)}`,
    );
  }

  const entries = String(listed.stdout ?? "")
    .split("\n")
    .filter((line) => line.length > 0 && line !== "./" && line !== ".").length;

  fs.chmodSync(destination, 0o600);

  return {
    file: path.basename(destination),
    size: fs.statSync(destination).size,
    sha256: sha256File(destination),
    entries,
  };
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
  const stamp = `kirameku-${backupTimestamp(createdAt)}`;
  const destination = path.join(backupDir, `${stamp}.db`);

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
  const sha256 = sha256File(destination);

  // Uploads are archived after the database so a slow upload tree never delays
  // the artifact that matters most. A failure here is reported but does not
  // invalidate the database backup (deploy-server.sh reads a non-zero exit as
  // "no backup at all" and would give up the safety net).
  let uploads: UploadsBackup | null = null;
  let uploadsError: string | null = null;

  if (process.argv.includes("--no-uploads")) {
    console.log("uploads: skipped (--no-uploads)");
  } else {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
    try {
      uploads = backupUploads(
        uploadDir,
        path.join(backupDir, `${stamp}-uploads.tar.gz`),
      );
    } catch (error) {
      uploadsError = error instanceof Error ? error.message : String(error);
      console.error(`uploads: FAILED - ${uploadsError}`);
      fs.rmSync(path.join(backupDir, `${stamp}-uploads.tar.gz`), {
        force: true,
      });
    }
  }

  const metadata = {
    file: path.basename(destination),
    createdAt: createdAt.toISOString(),
    size,
    sha256,
    migration,
    integrityOk,
    foreignKeyViolations,
    uploads,
    uploadsError,
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
  if (uploads) {
    console.log(
      `uploads: ${uploads.entries} entr(y/ies), ${uploads.size} bytes`,
    );
    console.log(`uploads sha256: ${uploads.sha256}`);
  }

  if (!integrityOk || foreignKeyViolations > 0) {
    process.exitCode = 1;
    return;
  }

  if (process.argv.includes("--prune")) {
    const removed = pruneBackups(backupDir);
    console.log(`pruned ${removed} old backup file(s)`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
