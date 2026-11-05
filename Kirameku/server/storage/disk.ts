import "server-only";
import fs from "node:fs";

export interface DiskUsage {
  path: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
}

/**
 * Free/total space of the filesystem that holds `target`.
 *
 * Reading `statfs` fails on some platforms and on paths that do not exist yet,
 * so callers get `null` instead of an exception: a missing disk reading must
 * never take down a status page or a health probe.
 */
export function readDiskUsage(target: string): DiskUsage | null {
  try {
    const stats = fs.statfsSync(target);
    const totalBytes = stats.blocks * stats.bsize;
    // 已用按「非空闲块」算（含 root 预留），与 df 的口径一致；
    // 可用只算非特权用户能写的块，两者相加不等于总量是正常的。
    const usedBytes = totalBytes - stats.bfree * stats.bsize;
    const availableBytes = stats.bavail * stats.bsize;
    return { path: target, totalBytes, usedBytes, availableBytes };
  } catch {
    return null;
  }
}
