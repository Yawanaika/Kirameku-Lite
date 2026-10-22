import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "../server/db/open";

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function verifyChecksum(file: string): void {
  const metadataPath = `${file}.meta.json`;
  if (!fs.existsSync(metadataPath)) {
    console.warn(`checksum: metadata not found, skipping (${metadataPath})`);
    return;
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as {
    sha256?: string;
  };
  if (!metadata.sha256) {
    console.warn(`checksum: sha256 missing from ${metadataPath}, skipping`);
    return;
  }

  const actual = crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
  if (actual !== metadata.sha256) {
    throw new Error(
      `checksum mismatch for ${file}: expected ${metadata.sha256}, got ${actual}`,
    );
  }
  console.log(`checksum: ${actual}`);
}

function verifyDatabase(file: string): void {
  const db = openDatabase(file, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.pragma("integrity_check") as Array<{
      integrity_check: string;
    }>;
    if (!(integrity.length === 1 && integrity[0]?.integrity_check === "ok")) {
      throw new Error(`integrity_check failed for ${file}`);
    }

    const violations = db.prepare("PRAGMA foreign_key_check").all() as unknown[];
    if (violations.length > 0) {
      throw new Error(
        `${file} has ${violations.length} foreign key violation(s)`,
      );
    }
  } finally {
    db.close();
  }
}

/** Uploads archived alongside this database by scripts/backup-db.ts, if any. */
function uploadsArchiveFor(backupPath: string): string | null {
  const base = path.basename(backupPath).replace(/\.db$/, "");
  const candidate = path.join(path.dirname(backupPath), `${base}-uploads.tar.gz`);
  return fs.existsSync(candidate) ? candidate : null;
}

function verifyUploadsChecksum(backupPath: string, archive: string): void {
  const metadataPath = `${backupPath}.meta.json`;
  if (!fs.existsSync(metadataPath)) return;

  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as {
    uploads?: { file?: string; sha256?: string } | null;
  };
  const expected = metadata.uploads;
  if (!expected?.sha256) return;
  if (expected.file && expected.file !== path.basename(archive)) {
    console.warn(
      `uploads: metadata describes ${expected.file}, restoring ${path.basename(archive)}`,
    );
  }

  const actual = crypto
    .createHash("sha256")
    .update(fs.readFileSync(archive))
    .digest("hex");
  if (actual !== expected.sha256) {
    throw new Error(
      `checksum mismatch for ${archive}: expected ${expected.sha256}, got ${actual}`,
    );
  }
  console.log(`uploads checksum: ${actual}`);
}

function restoreUploads(archive: string, uploadsDir: string): void {
  fs.mkdirSync(uploadsDir, { recursive: true });
  const result = spawnSync("tar", ["-xzf", archive, "-C", uploadsDir], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(
      `uploads extract failed: ${
        result.error?.message ??
        `tar exited with ${result.status}: ${String(result.stderr ?? "").trim()}`
      }`,
    );
  }
  console.log(`restored uploads into: ${uploadsDir}`);
}

function main() {
  const backupArg = process.argv[2];
  if (!backupArg || backupArg.startsWith("--")) {
    throw new Error(
      "Usage: pnpm db:restore <backup.db> [--target ./data/kirameku.db] [--with-uploads] [--uploads-dir ./uploads]",
    );
  }

  const backupPath = path.resolve(backupArg);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }

  const targetPath = path.resolve(
    flagValue("--target") ||
      process.env.DATABASE_PATH ||
      "./data/kirameku.db",
  );

  verifyChecksum(backupPath);
  verifyDatabase(backupPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  const suffix = new Date().toISOString().replace(/[:.]/g, "-");
  const moved: string[] = [];

  for (const extension of ["", "-wal", "-shm"]) {
    const current = `${targetPath}${extension}`;
    if (!fs.existsSync(current)) continue;
    const next = `${targetPath}.pre-restore-${suffix}${extension}`;
    fs.renameSync(current, next);
    moved.push(next);
  }

  fs.copyFileSync(backupPath, targetPath);
  verifyDatabase(targetPath);

  console.log(`restored: ${targetPath}`);
  console.log(`from: ${backupPath}`);
  for (const file of moved) {
    console.log(`previous file moved to: ${file}`);
  }

  const uploadsArchive = uploadsArchiveFor(backupPath);
  if (!uploadsArchive) {
    console.log("uploads: no archive next to this backup, skipped");
    return;
  }

  if (!process.argv.includes("--with-uploads")) {
    console.log(
      `uploads: archive available at ${uploadsArchive} (pass --with-uploads to restore it)`,
    );
    return;
  }

  const uploadsDir = path.resolve(
    flagValue("--uploads-dir") || process.env.UPLOAD_DIR || "./uploads",
  );
  verifyUploadsChecksum(backupPath, uploadsArchive);
  restoreUploads(uploadsArchive, uploadsDir);
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
