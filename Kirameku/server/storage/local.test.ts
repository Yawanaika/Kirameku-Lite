import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "@/server/http/errors";
import {
  buildUploadKey,
  contentTypeForUpload,
  readLocalImage,
  resolveUploadPath,
  writeLocalImage,
} from "./local";

const roots: string[] = [];

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "kirameku-upload-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("local upload storage", () => {
  it("writes a date-partitioned key and reads it back", async () => {
    const root = await createRoot();
    const key = buildUploadKey("png", new Date("2026-10-22T00:00:00Z"));
    expect(key).toMatch(/^2026\/10\/[0-9a-f-]{36}\.png$/);

    await writeLocalImage(root, key, Buffer.from("image-bytes"));
    const file = await readLocalImage(root, key.split("/"));
    expect(file.contentType).toBe("image/png");
    expect(file.body.toString()).toBe("image-bytes");
  });

  it("rejects path traversal and unsupported extensions", async () => {
    const root = await createRoot();
    expect(() => resolveUploadPath(root, ["..", "kirameku.db"])).toThrow(
      AppError,
    );
    expect(() => resolveUploadPath(root, ["2026", "..", "x.png"])).toThrow(
      AppError,
    );
    expect(contentTypeForUpload(path.join(root, "shell.html"))).toBeNull();
  });

  it("returns 404 for missing files", async () => {
    const root = await createRoot();
    await expect(readLocalImage(root, ["2026", "10", "missing.png"])).rejects
      .toThrow(AppError);
  });
});
