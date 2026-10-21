import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { createFriendLinksService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let friendLinks!: ReturnType<typeof createFriendLinksService>;

function insertFriendLink(input: {
  name: string;
  url: string;
  sort?: number;
  approved?: boolean;
  avatar?: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number | null;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "friend_link"
          ("name", "url", "avatar", "description", "sort", "is_approved",
           "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.name,
        input.url,
        input.avatar ?? "",
        input.description ?? "",
        input.sort ?? 0,
        input.approved ? 1 : 0,
        input.createdAt ?? Date.UTC(2026, 0, 1),
        input.updatedAt === undefined ? Date.UTC(2026, 0, 1) : input.updatedAt,
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-friend-links-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  insertFriendLink({
    name: "second",
    url: "https://second.example",
    sort: 2,
    approved: true,
    createdAt: Date.UTC(2026, 0, 2),
  });
  insertFriendLink({
    name: "first",
    url: "https://first.example",
    sort: 1,
    approved: true,
    avatar: "/first.png",
    description: "first friend",
    createdAt: Date.UTC(2026, 0, 1),
    updatedAt: null,
  });
  insertFriendLink({
    name: "pending",
    url: "https://pending.example",
    sort: 0,
    approved: false,
  });

  friendLinks = createFriendLinksService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("friend links service", () => {
  it("returns only approved links ordered by sort and id", async () => {
    const rows = await friendLinks.listApproved();

    expect(rows.map((row) => row.name)).toEqual(["first", "second"]);
    expect(rows[0]).toMatchObject({
      name: "first",
      url: "https://first.example",
      avatar: "/first.png",
      description: "first friend",
      sort: 1,
      is_approved: true,
      created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      updated_at: null,
    });
    expect(rows[1]).toMatchObject({
      name: "second",
      sort: 2,
      is_approved: true,
    });
  });

  it("never exposes unapproved links", async () => {
    const rows = await friendLinks.listApproved();
    expect(rows.some((row) => row.name === "pending")).toBe(false);
  });
});
