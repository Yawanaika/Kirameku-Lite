import { asc, count, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { album, photo } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type {
  AlbumItem,
  CreateAlbumInput,
  CreatePhotoInput,
  PhotoItem,
  UpdateAlbumInput,
} from "./contracts";

type AlbumRow = Pick<
  typeof album.$inferSelect,
  | "id"
  | "title"
  | "description"
  | "cover"
  | "photoCount"
  | "sort"
  | "createdAt"
  | "updatedAt"
>;

type PhotoRow = Pick<
  typeof photo.$inferSelect,
  | "id"
  | "albumId"
  | "url"
  | "caption"
  | "orientation"
  | "sort"
  | "createdAt"
>;

function toAlbum(row: AlbumRow): AlbumItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    cover: row.cover ?? "",
    photo_count: row.photoCount ?? 0,
    sort: row.sort ?? 0,
    created_at: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? new Date(0).toISOString(),
  };
}

function toPhoto(row: PhotoRow): PhotoItem {
  return {
    id: row.id,
    album_id: row.albumId,
    url: row.url,
    caption: row.caption ?? "",
    orientation: row.orientation ?? "landscape",
    sort: row.sort ?? 0,
    created_at: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
  };
}

export function createAlbumsService(db: AppDatabase) {
  async function ensureAlbum(id: number): Promise<void> {
    const [row] = await db
      .select({ id: album.id })
      .from(album)
      .where(eq(album.id, id))
      .limit(1);
    if (!row) throw errors.notFound("相册不存在");
  }

  async function recomputePhotoCount(albumId: number): Promise<void> {
    const [row] = await db
      .select({ value: count(photo.id) })
      .from(photo)
      .where(eq(photo.albumId, albumId));
    await db
      .update(album)
      .set({ photoCount: row?.value ?? 0, updatedAt: new Date() })
      .where(eq(album.id, albumId));
  }

  return {
    async list(): Promise<AlbumItem[]> {
      const rows = await db
        .select({
          id: album.id,
          title: album.title,
          description: album.description,
          cover: album.cover,
          photoCount: album.photoCount,
          sort: album.sort,
          createdAt: album.createdAt,
          updatedAt: album.updatedAt,
        })
        .from(album)
        .orderBy(asc(album.sort), asc(album.id));

      return rows.map(toAlbum);
    },

    async getById(id: number): Promise<AlbumItem> {
      const [row] = await db
        .select({
          id: album.id,
          title: album.title,
          description: album.description,
          cover: album.cover,
          photoCount: album.photoCount,
          sort: album.sort,
          createdAt: album.createdAt,
          updatedAt: album.updatedAt,
        })
        .from(album)
        .where(eq(album.id, id))
        .limit(1);
      if (!row) throw errors.notFound("相册不存在");
      return toAlbum(row);
    },

    async listPhotos(albumId: number): Promise<PhotoItem[]> {
      const rows = await db
        .select({
          id: photo.id,
          albumId: photo.albumId,
          url: photo.url,
          caption: photo.caption,
          orientation: photo.orientation,
          sort: photo.sort,
          createdAt: photo.createdAt,
        })
        .from(photo)
        .where(eq(photo.albumId, albumId))
        .orderBy(asc(photo.sort), asc(photo.id));

      return rows.map(toPhoto);
    },

    async create(input: CreateAlbumInput): Promise<AlbumItem> {
      const [row] = await db
        .insert(album)
        .values({
          title: input.title,
          description: input.description,
          cover: input.cover,
          sort: input.sort,
        })
        .returning();
      if (!row) throw errors.internal("保存相册失败");
      return toAlbum(row);
    },

    async update(id: number, input: UpdateAlbumInput): Promise<AlbumItem> {
      const values: Partial<typeof album.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.title !== undefined) values.title = input.title;
      if (input.description !== undefined) {
        values.description = input.description;
      }
      if (input.cover !== undefined) values.cover = input.cover;
      if (input.sort !== undefined) values.sort = input.sort;

      const [row] = await db
        .update(album)
        .set(values)
        .where(eq(album.id, id))
        .returning();
      if (!row) throw errors.notFound("相册不存在");
      return toAlbum(row);
    },

    async remove(id: number): Promise<{ ok: true }> {
      const [row] = await db
        .delete(album)
        .where(eq(album.id, id))
        .returning({ id: album.id });
      if (!row) throw errors.notFound("相册不存在");
      return { ok: true };
    },

    async addPhoto(input: CreatePhotoInput): Promise<PhotoItem> {
      await ensureAlbum(input.album_id);

      const [row] = await db
        .insert(photo)
        .values({
          albumId: input.album_id,
          url: input.url,
          caption: input.caption,
          orientation: input.orientation,
          sort: input.sort,
        })
        .returning();
      if (!row) throw errors.internal("保存照片失败");
      await recomputePhotoCount(input.album_id);
      return toPhoto(row);
    },

    async removePhoto(id: number): Promise<{ ok: true }> {
      const [existing] = await db
        .select({ albumId: photo.albumId })
        .from(photo)
        .where(eq(photo.id, id))
        .limit(1);
      if (!existing) throw errors.notFound("照片不存在");

      await db.delete(photo).where(eq(photo.id, id));
      await recomputePhotoCount(existing.albumId);
      return { ok: true };
    },
  };
}

export type AlbumsService = ReturnType<typeof createAlbumsService>;
