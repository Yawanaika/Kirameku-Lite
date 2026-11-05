import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteBackupGroups,
  readBackupOverview,
  summarizeBackups,
} from "./service";

let directory: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-backups-"));
});

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

/** 与前缀约定一致的文件名：时间戳里的 : 和 . 换成了 -。 */
function stampAgo(hours: number): string {
  const date = new Date(Date.now() - hours * 3_600_000);
  return `kirameku-${date.toISOString().replace(/[:.]/g, "-")}`;
}

function writeFile(name: string, bytes: number): void {
  fs.writeFileSync(path.join(directory, name), Buffer.alloc(bytes));
}

describe("readBackupOverview", () => {
  it("groups files that share a timestamp and sorts newest first", () => {
    const old = stampAgo(48);
    const recent = stampAgo(1);
    writeFile(`${old}.db`, 100);
    writeFile(`${old}.db.meta.json`, 10);
    writeFile(`${recent}.db`, 200);
    writeFile(`${recent}-uploads.tar.gz`, 50);

    const overview = readBackupOverview(directory);

    expect(overview.unreadable).toBe(false);
    expect(overview.counts).toEqual({
      groups: 2,
      databases: 2,
      uploadsArchives: 1,
    });
    expect(overview.totalBytes).toBe(360);
    expect(overview.groups.map((group) => group.stamp)).toEqual([
      recent,
      old,
    ]);
    // 元数据文件归到同一组，不单独成组。
    expect(overview.groups[1].metadata).toBe(`${old}.db.meta.json`);
    expect(overview.groups[0].database).toBe(`${recent}.db`);
    expect(overview.groups[0].uploadsBytes).toBe(50);
  });

  it("reports the newest database snapshot as fresh", () => {
    writeFile(`${stampAgo(2)}.db`, 100);

    const overview = readBackupOverview(directory);

    expect(overview.stale).toBe(false);
    expect(overview.latestAgeSeconds).toBeGreaterThan(7_000);
    expect(overview.latestAgeSeconds).toBeLessThan(7_400);
  });

  it("marks the snapshot stale once it is older than the threshold", () => {
    writeFile(`${stampAgo(31)}.db`, 100);

    const overview = readBackupOverview(directory);

    expect(overview.staleAfterHours).toBe(30);
    expect(overview.stale).toBe(true);
  });

  it("treats an empty directory as stale with no snapshots", () => {
    const overview = readBackupOverview(directory);

    expect(overview.groups).toEqual([]);
    expect(overview.latestFile).toBeNull();
    expect(overview.latestAgeSeconds).toBeNull();
    expect(overview.stale).toBe(true);
  });

  it("flags a directory that does not exist instead of throwing", () => {
    const overview = readBackupOverview(path.join(directory, "missing"));

    expect(overview.unreadable).toBe(true);
    expect(overview.stale).toBe(true);
    expect(overview.groups).toEqual([]);
  });

  it("ignores files that do not follow the backup naming convention", () => {
    writeFile("notes.txt", 10);
    writeFile("kirameku-not-a-date.db", 10);
    writeFile("kirameku-2026-01-01.db", 10);
    writeFile(`${stampAgo(1)}.db`, 100);

    const overview = readBackupOverview(directory);

    expect(overview.counts.databases).toBe(1);
    expect(overview.totalBytes).toBe(100);
  });

  it("keeps a group that only has an uploads archive", () => {
    writeFile(`${stampAgo(3)}-uploads.tar.gz`, 40);

    const overview = readBackupOverview(directory);

    expect(overview.counts).toEqual({
      groups: 1,
      databases: 0,
      uploadsArchives: 1,
    });
    expect(overview.latestFile).toBe(overview.groups[0].uploads);
    // 没有数据库快照就是没有可恢复的备份，即使图片归档还很新。
    expect(overview.stale).toBe(true);
  });
});

describe("deleteBackupGroups", () => {
  it("removes every file of the requested group and keeps the rest", () => {
    const target = stampAgo(30);
    const keep = stampAgo(1);
    writeFile(`${target}.db`, 100);
    writeFile(`${target}.db.meta.json`, 10);
    writeFile(`${target}-uploads.tar.gz`, 50);
    // 不符合命名约定的同名文件不该被顺手删掉。
    writeFile(`${target}.txt`, 5);
    writeFile(`${keep}.db`, 200);

    const result = deleteBackupGroups([target], directory);

    expect(result.missing).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.deleted).toHaveLength(1);
    expect(result.deleted[0].stamp).toBe(target);
    expect(result.deleted[0].bytes).toBe(160);
    expect(result.deleted[0].files.sort()).toEqual(
      [`${target}.db`, `${target}.db.meta.json`, `${target}-uploads.tar.gz`].sort(),
    );
    expect(fs.existsSync(path.join(directory, `${target}.txt`))).toBe(true);
    expect(fs.existsSync(path.join(directory, `${keep}.db`))).toBe(true);
    expect(readBackupOverview(directory).counts.groups).toBe(1);
  });

  it("deletes several groups in one call", () => {
    const first = stampAgo(20);
    const second = stampAgo(10);
    writeFile(`${first}.db`, 10);
    writeFile(`${second}.db`, 20);

    const result = deleteBackupGroups([first, second], directory);

    expect(result.deleted.map((group) => group.stamp)).toEqual([first, second]);
    expect(fs.readdirSync(directory)).toEqual([]);
  });

  it("reports stamps that are not in the directory instead of failing", () => {
    writeFile(`${stampAgo(1)}.db`, 10);

    const result = deleteBackupGroups(
      ["kirameku-2020-01-01T00-00-00-000Z", "../../etc/passwd"],
      directory,
    );

    expect(result.deleted).toEqual([]);
    expect(result.missing).toEqual([
      "kirameku-2020-01-01T00-00-00-000Z",
      "../../etc/passwd",
    ]);
  });

  it("throws when the backup directory cannot be read", () => {
    expect(() =>
      deleteBackupGroups([stampAgo(1)], path.join(directory, "missing")),
    ).toThrow(/备份目录不可读/);
  });
});

describe("summarizeBackups", () => {
  it("maps the overview onto the metrics contract", () => {
    const recent = stampAgo(1);
    writeFile(`${recent}.db`, 100);
    writeFile(`${recent}-uploads.tar.gz`, 25);

    const summary = summarizeBackups(directory);

    expect(summary).toMatchObject({
      dir: directory,
      count: 1,
      uploads_archives: 1,
      total_bytes: 125,
      latest_file: `${recent}.db`,
    });
    expect(summary.latest_age_s).toBeGreaterThan(3_500);
  });
});
