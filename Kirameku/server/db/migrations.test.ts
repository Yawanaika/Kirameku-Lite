import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";
import { openDatabase, type DatabaseConnection } from "./open";
import { TABLES } from "./tables";

const tempDirectories: string[] = [];
let current: DatabaseConnection | undefined;

function createDatabase(): DatabaseConnection {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-db-"));
  tempDirectories.push(directory);
  const file = path.join(directory, "kirameku.db");
  const connection = openDatabase(file);
  connection.pragma("auto_vacuum = INCREMENTAL");
  connection.exec("VACUUM");
  runMigrations(connection);
  return connection;
}

afterEach(() => {
  current?.close();
  current = undefined;
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("SQLite baseline", () => {
  it("creates every table with the expected columns", () => {
    const database = createDatabase();
    current = database;

    for (const table of TABLES) {
      const columns = database
        .prepare(`PRAGMA table_info("${table.name}")`)
        .all() as Array<{
        name: string;
        type: string;
        notnull: number;
        pk: number;
      }>;

      expect(
        columns.map((column) => column.name),
        `columns for ${table.name}`,
      ).toEqual(table.columns.map((column) => column.name));

      for (const expected of table.columns) {
        const actual = columns.find((column) => column.name === expected.name);
        expect(actual, `${table.name}.${expected.name} exists`).toBeDefined();
        if (!actual) continue;

        const expectedType =
          expected.kind === "text" || expected.kind === "json"
            ? "TEXT"
            : "INTEGER";
        expect(
          actual.type.toUpperCase(),
          `${table.name}.${expected.name} type`,
        ).toBe(expectedType);

        if (expected.kind !== "id") {
          expect(
            actual.notnull,
            `${table.name}.${expected.name} nullability`,
          ).toBe(expected.nullable ? 0 : 1);
        }
      }
    }
  });

  it("records the migration and passes integrity checks", () => {
    const database = createDatabase();
    current = database;

    const migrations = database
      .prepare('SELECT "filename" FROM "__migrations"')
      .all() as Array<{ filename: string }>;
    expect(migrations.map((row) => row.filename)).toEqual([
      "0000_initial.sql",
      "0001_seed_projects.sql",
    ]);

    const integrity = database.pragma("integrity_check") as Array<{
      integrity_check: string;
    }>;
    expect(integrity).toEqual([{ integrity_check: "ok" }]);
    expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("enforces unique keys and foreign-key cascades", () => {
    const database = createDatabase();
    current = database;

    database
      .prepare(
        'INSERT INTO "user" ("username", "hashed_password") VALUES (?, ?)',
      )
      .run("admin", "hash");
    expect(() =>
      database
        .prepare(
          'INSERT INTO "user" ("username", "hashed_password") VALUES (?, ?)',
        )
        .run("admin", "other"),
    ).toThrow();

    const categoryId = Number(
      database
        .prepare('INSERT INTO "category" ("name", "slug") VALUES (?, ?)')
        .run("Category", "category").lastInsertRowid,
    );
    const postId = Number(
      database
        .prepare(
          'INSERT INTO "post" ("title", "slug", "category_id") VALUES (?, ?, ?)',
        )
        .run("Post", "post", categoryId).lastInsertRowid,
    );
    database
      .prepare('INSERT INTO "comment" ("post_id", "content") VALUES (?, ?)')
      .run(postId, "hello");

    database.prepare('DELETE FROM "post" WHERE "id" = ?').run(postId);
    const comments = database
      .prepare('SELECT count(*) AS count FROM "comment"')
      .get() as { count: number };
    expect(comments.count).toBe(0);
  });
});
