import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { env } from "@/server/env";
import { writeLocalImage } from "@/server/storage/local";
import { GET } from "./route";

const roots: string[] = [];
let root = "";

function call(segments: string[]): Promise<Response> {
  const encoded = segments.map(encodeURIComponent).join("/");
  return GET(new Request(`http://localhost:3000/uploads/${encoded}`), {
    params: Promise.resolve({ path: segments }),
  });
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "kirameku-route-"));
  roots.push(root);
  // `env` is a plain parsed object; getUploadRoot() reads it on every call.
  env.UPLOAD_DIR = root;
});

afterEach(async () => {
  env.UPLOAD_DIR = undefined;
  await Promise.all(
    roots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("GET /uploads/*", () => {
  it("serves a stored image with immutable caching", async () => {
    await writeLocalImage(root, "2026/10/photo.png", Buffer.from("png-bytes"));

    const response = await call(["2026", "10", "photo.png"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      "png-bytes",
    );
  });

  it("returns 404 for a missing file", async () => {
    const response = await call(["2026", "10", "missing.png"]);
    expect(response.status).toBe(404);
  });

  it("returns 404 for a traversal attempt", async () => {
    const response = await call(["..", "kirameku.db"]);
    expect(response.status).toBe(404);
  });

  it("returns 404 for a non-image extension", async () => {
    await writeLocalImage(root, "2026/10/note.html", Buffer.from("<script>"));
    const response = await call(["2026", "10", "note.html"]);
    expect(response.status).toBe(404);
  });
});
