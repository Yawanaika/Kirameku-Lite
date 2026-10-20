import { describe, expect, it } from "vitest";
import { TABLE_BY_NAME } from "../../server/db/tables";
import {
  buildSelectList,
  buildSnapshot,
  compareSnapshots,
  normalizeValue,
} from "./manifest";

describe("migration manifest", () => {
  it("normalizes timestamps, booleans and JSON", () => {
    expect(normalizeValue(new Date(1_700_000_000_000), "timestamp")).toBe(
      1_700_000_000_000,
    );
    expect(normalizeValue("1700000000000", "timestamp")).toBe(
      1_700_000_000_000,
    );
    expect(normalizeValue(true, "boolean")).toBe(1);
    expect(normalizeValue("false", "boolean")).toBe(0);
    expect(normalizeValue('{"a":1}', "json")).toBe('{"a":1}');
    expect(() => normalizeValue("{broken", "json")).toThrow(
      "Invalid JSON value",
    );
  });

  it("builds PostgreSQL conversion expressions", () => {
    const post = TABLE_BY_NAME.get("post");
    expect(post).toBeDefined();
    const select = buildSelectList(post!);
    expect(select).toContain(
      `EXTRACT(EPOCH FROM ("published_at" AT TIME ZONE 'Asia/Shanghai')) * 1000 AS "published_at"`,
    );
    expect(select).toContain(
      'CASE WHEN "is_pinned" IS NULL THEN NULL WHEN "is_pinned" THEN 1 ELSE 0 END AS "is_pinned"',
    );
  });

  it("compares row counts, hashes and sequences", () => {
    const post = TABLE_BY_NAME.get("post")!;
    const rows = [
      { id: 1, title: "A", slug: "a", published_at: 1000, is_pinned: 0 },
    ];
    const snapshot = buildSnapshot(rows, post, 1);
    expect(snapshot.rowCount).toBe(1);
    expect(snapshot.maxId).toBe(1);
    expect(compareSnapshots(snapshot, snapshot).ok).toBe(true);

    const missingSequence = { ...snapshot, sequence: null };
    expect(compareSnapshots(snapshot, missingSequence).mismatches).toContain(
      "sqlite_sequence missing < maxId 1",
    );
  });
});
