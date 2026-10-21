import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { errors } from "@/server/http/errors";
import type { ImageInfo } from "./image";

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Build a date-partitioned key so uploads stay manageable on disk. */
export function buildUploadKey(ext: ImageInfo["ext"], now = new Date()): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}/${randomUUID()}.${ext}`;
}

export function resolveUploadPath(rootDir: string, segments: string[]): string {
  if (segments.length === 0) throw errors.notFound("文件不存在");

  for (const segment of segments) {
    if (
      !segment ||
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\") ||
      segment.includes("\0")
    ) {
      throw errors.notFound("文件不存在");
    }
  }

  const root = path.resolve(rootDir);
  const target = path.resolve(root, ...segments);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw errors.notFound("文件不存在");
  }
  return target;
}

export function contentTypeForUpload(filePath: string): string | null {
  return MIME_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? null;
}

export async function writeLocalImage(
  rootDir: string,
  key: string,
  buffer: Buffer,
): Promise<string> {
  const segments = key.split("/");
  const target = resolveUploadPath(rootDir, segments);
  await mkdir(path.dirname(target), { recursive: true });
  // "wx" prevents silently overwriting an existing object if a key collides.
  await writeFile(target, buffer, { flag: "wx" });
  return target;
}

export async function readLocalImage(
  rootDir: string,
  segments: string[],
): Promise<{ body: Buffer; contentType: string }> {
  const target = resolveUploadPath(rootDir, segments);
  const contentType = contentTypeForUpload(target);
  if (!contentType) throw errors.notFound("文件不存在");

  try {
    return { body: await readFile(target), contentType };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EISDIR" || code === "ENOTDIR") {
      throw errors.notFound("文件不存在");
    }
    throw error;
  }
}
