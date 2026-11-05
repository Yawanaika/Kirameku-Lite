import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSqlite, statSync } = vi.hoisted(() => ({
  getSqlite: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({ getSqlite }));
vi.mock("node:fs", () => ({ default: { statSync } }));
vi.mock("@/server/env", () => ({
  env: {
    DATABASE_PATH: "/tmp/kirameku.db",
    AUTH_SECRET: "x".repeat(32),
  },
}));

import { GET } from "./route";

function request() {
  return new Request("http://localhost/api/health");
}

beforeEach(() => {
  vi.clearAllMocks();
  statSync.mockReturnValue({ size: 4096 });
});

describe("GET /api/health", () => {
  it("reports ok with the latest migration", async () => {
    getSqlite.mockReturnValue({
      prepare: (sql: string) =>
        sql.includes("__migrations")
          ? { get: () => ({ filename: "0032_last.sql" }) }
          : { get: () => ({ ok: 1 }) },
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      ok: true,
      db: "ok",
      migration: "0032_last.sql",
      auth: "ok",
      db_size_bytes: 4096,
    });
  });

  it("returns 503 when the database is unreachable", async () => {
    getSqlite.mockImplementation(() => {
      throw new Error("cannot open database");
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, db: "unavailable" });
    // 探针只关心可用性，不把内部错误文案暴露出去
    expect(JSON.stringify(body)).not.toContain("cannot open database");
  });

  it("tolerates a missing migration row and an unknown db size", async () => {
    statSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    getSqlite.mockReturnValue({
      prepare: () => ({ get: () => undefined }),
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: false,
      db: "ok",
      migration: null,
      db_size_bytes: null,
    });
  });
});
