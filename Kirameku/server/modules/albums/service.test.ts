import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { albumIdParams } from "@/server/modules/albums/contracts";
import { createAlbumsService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let albums: ReturnType<typeof createAlbumsService>;
let albumOne: number;
let albumTwo: number;

function insertAlbum(input: {
  title: string;
  description?: string;
  cover?: string;
  photoCount?: number;
  sort?: number;
  createdAt?: number;
  updatedAt?: number;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "album"
          ("title", "description", "cover", "photo_count", "sort",
           "created_at", "updated_at")
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.description ?? "",
        input.cover ?? "",
        input.photoCount ?? 0,
        input.sort ?? 0,
        input.createdAt ?? Date.UTC(2026, 0, 1),
        input.updatedAt ?? Date.UTC(2026, 0, 1),
      ).lastInsertRowid,
  );
}

function insertPhoto(input: {
  albumId: number;
  url: string;
  caption?: string;
  orientation?: string;
  sort?: number;
  createdAt?: number;
}): number {
  return Number(
    connection
      .prepare(
        `INSERT INTO "photo"
          ("album_id", "url", "caption", "orientation", "sort", "created_at")
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.albumId,
        input.url,
        input.caption ?? "",
        input.orientation ?? "landscape",
        input.sort ?? 0,
        input.createdAt ?? Date.UTC(2026, 0, 1),
      ).lastInsertRowid,
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-albums-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });

  albumTwo = insertAlbum({
    title: "second album",
    description: "second description",
    cover: "/second.jpg",
    photoCount: 2,
    sort: 2,
    createdAt: Date.UTC(2026, 0, 2),
    updatedAt: Date.UTC(2026, 0, 3),
  });
  albumOne = insertAlbum({
    title: "first album",
    description: "first description",
    cover: "/first.jpg",
    photoCount: 1,
    sort: 1,
    createdAt: Date.UTC(2026, 0, 1),
    updatedAt: Date.UTC(2026, 0, 1),
  });

  insertPhoto({
    albumId: albumOne,
    url: "/first-2.jpg",
    caption: "first album second photo",
    orientation: "portrait",
    sort: 2,
  });
  insertPhoto({
    albumId: albumOne,
    url: "/first-1.jpg",
    caption: "first album first photo",
    sort: 1,
    createdAt: Date.UTC(2026, 0, 2),
  });
  insertPhoto({
    albumId: albumTwo,
    url: "/second-1.jpg",
    caption: "second album photo",
    sort: 1,
  });

  albums = createAlbumsService(db);
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("albums service", () => {
  it("lists albums ordered by sort and maps timestamps", async () => {
    const rows = await albums.list();

    expect(rows.map((row) => row.id)).toEqual([albumOne, albumTwo]);
    expect(rows[0]).toMatchObject({
      title: "first album",
      description: "first description",
      cover: "/first.jpg",
      photo_count: 1,
      sort: 1,
      created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      updated_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    });
    expect(rows[1]).toMatchObject({
      title: "second album",
      photo_count: 2,
      sort: 2,
    });
  });

  it("lists photos for one album ordered by sort and id", async () => {
    const rows = await albums.listPhotos(albumOne);

    expect(rows.map((row) => row.url)).toEqual([
      "/first-1.jpg",
      "/first-2.jpg",
    ]);
    expect(rows[0]).toMatchObject({
      album_id: albumOne,
      caption: "first album first photo",
      orientation: "landscape",
      sort: 1,
      created_at: new Date(Date.UTC(2026, 0, 2)).toISOString(),
    });
    expect(rows[1]).toMatchObject({
      orientation: "portrait",
      sort: 2,
    });
  });

  it("returns an empty list for an album without photos", async () => {
    await expect(albums.listPhotos(999999)).resolves.toEqual([]);
  });

  it("validates album id params", () => {
    expect(albumIdParams.parse({ id: "12" })).toEqual({ id: 12 });
    expect(albumIdParams.safeParse({ id: "0" }).success).toBe(false);
    expect(albumIdParams.safeParse({ id: "abc" }).success).toBe(false);
  });
});
