import { asc, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { album, photo } from "@/server/db/schema";
import type { AlbumItem, PhotoItem } from "./contracts";

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
  };
}

export type AlbumsService = ReturnType<typeof createAlbumsService>;
