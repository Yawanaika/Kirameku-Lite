import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { AppError } from "@/server/http/errors";
import { createProjectsService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let projects: ReturnType<typeof createProjectsService>;

function insertProject(input: {
  name: string;
  slug: string;
  techStack?: string | null;
  status?: string;
  sort: number;
  createdAt: number;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "project"
          ("name", "slug", "description", "tech_stack", "status", "sort",
           "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.name,
        input.slug,
        `${input.name} description`,
        input.techStack ?? "[]",
        input.status ?? "active",
        input.sort,
        input.createdAt,
        input.createdAt,
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-projects-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  connection.prepare('DELETE FROM "project"').run();
  db = drizzle(connection, { schema });

  insertProject({
    name: "Second",
    slug: "second",
    techStack: JSON.stringify(["TypeScript"]),
    sort: 2,
    createdAt: Date.UTC(2026, 0, 2),
  });
  insertProject({
    name: "First",
    slug: "first",
    techStack: "not-json",
    sort: 1,
    createdAt: Date.UTC(2026, 0, 1),
  });
  projects = createProjectsService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("projects service", () => {
  it("lists projects by sort order and parses tech stacks", async () => {
    const rows = await projects.list();

    expect(rows.map((row) => row.slug)).toEqual(["first", "second"]);
    expect(rows[0]).toMatchObject({
      name: "First",
      description: "First description",
      tech_stack: [],
      status: "active",
      is_featured: false,
    });
    expect(rows[1].tech_stack).toEqual(["TypeScript"]);
  });

  it("gets projects by slug and id", async () => {
    await expect(projects.getBySlug("first")).resolves.toMatchObject({
      name: "First",
      slug: "first",
    });
    await expect(projects.getBySlug("missing")).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(projects.getById(999999)).rejects.toBeInstanceOf(AppError);
  });

  it("creates and updates projects", async () => {
    const created = await projects.create({
      name: "New Project",
      slug: "new-project",
      description: "new description",
      long_description: "long description",
      cover_image: "/cover.webp",
      tech_stack: ["Rust", "SQLite"],
      link_github: "https://github.com/example/new",
      link_gitee: "",
      link_live: "https://example.com",
      link_docs: "",
      status: "developing",
      status_label: "开发中",
      is_featured: true,
      sort: 0,
    });

    expect(created).toMatchObject({
      name: "New Project",
      slug: "new-project",
      description: "new description",
      long_description: "long description",
      cover_image: "/cover.webp",
      tech_stack: ["Rust", "SQLite"],
      link_github: "https://github.com/example/new",
      link_live: "https://example.com",
      status: "developing",
      status_label: "开发中",
      is_featured: true,
      sort: 0,
    });

    const updated = await projects.update(created.id, {
      name: "Updated Project",
      slug: "updated-project",
      tech_stack: [],
      is_featured: false,
      sort: 9,
    });
    expect(updated).toMatchObject({
      id: created.id,
      name: "Updated Project",
      slug: "updated-project",
      tech_stack: [],
      is_featured: false,
      sort: 9,
    });

    await expect(
      projects.create({
        name: "Duplicate",
        slug: "updated-project",
        description: "",
        long_description: "",
        cover_image: "",
        tech_stack: [],
        link_github: "",
        link_gitee: "",
        link_live: "",
        link_docs: "",
        status: "developing",
        status_label: "",
        is_featured: false,
        sort: 0,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      projects.update(created.id, { slug: "first" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      projects.update(999999, { name: "missing" }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("deletes projects", async () => {
    const [row] = await projects.list();
    await expect(projects.remove(row.id)).resolves.toEqual({ ok: true });
    await expect(projects.remove(row.id)).rejects.toBeInstanceOf(AppError);
  });
});
