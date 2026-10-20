import crypto from "node:crypto";
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

function main() {
  const backupArg = process.argv[2];
  if (!backupArg || backupArg.startsWith("--")) {
    throw new Error(
      "Usage: pnpm db:restore <backup.db> [--target ./data/kirameku.db]",
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
}

try {
  main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
