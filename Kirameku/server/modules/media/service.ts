import "server-only";
import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { album, photo } from "@/server/db/schema";
import type {
  MediaItem,
  MediaListQuery,
  MediaOverview,
} from "./contracts";

interface PhotoRow {
  id: number;
  url: string;
  caption: string | null;
  albumId: number;
  albumTitle: string | null;
  orientation: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  createdAt: Date | null;
}

function toItem(row: PhotoRow): MediaItem {
  return {
    id: row.id,
    url: row.url,
    caption: row.caption ?? "",
    album_id: row.albumId,
    album_title: row.albumTitle ?? "(已删除的相册)",
    orientation: row.orientation ?? "landscape",
    width: row.width ?? null,
    height: row.height ?? null,
    bytes: row.bytes ?? null,
    format: row.format ?? null,
    created_at: row.createdAt?.toISOString() ?? null,
  };
}

const photoColumns = {
  id: photo.id,
  url: photo.url,
  caption: photo.caption,
  albumId: photo.albumId,
  albumTitle: album.title,
  orientation: photo.orientation,
  width: photo.width,
  height: photo.height,
  bytes: photo.bytes,
  format: photo.format,
  createdAt: photo.createdAt,
};

export function createMediaService(db: AppDatabase) {
  return {
    /**
     * 媒体库只读视图。
     *
     * 元数据是上传时存下来的，老照片那几列为 NULL。这里不做「按文件大小猜」的
     * 回填：外链图片根本不在本机，猜出来的数字只会让筛选更不可信。宁可在列表
     * 里显式标出「未记录」，让缺失量一眼可见。
     */
    async overview(query: MediaListQuery): Promise<MediaOverview> {
      const filters = query.albumId
        ? and(eq(photo.albumId, query.albumId))
        : undefined;

      const order =
        query.sort === "size"
          ? // NULL 排在最后，否则「未记录」会挤占体积榜首。
            [sql`${photo.bytes} IS NULL`, desc(photo.bytes), desc(photo.id)]
          : [desc(photo.createdAt), desc(photo.id)];

      const rows = await db
        .select(photoColumns)
        .from(photo)
        .leftJoin(album, eq(album.id, photo.albumId))
        .where(filters)
        .orderBy(...order)
        .limit(query.size)
        .offset((query.page - 1) * query.size);

      const [totalRow] = await db
        .select({ value: count(photo.id) })
        .from(photo)
        .where(filters);

      const [sumRow] = await db
        .select({
          bytes: sql<number | null>`sum(${photo.bytes})`,
          missing: sql<number>`sum(CASE WHEN ${photo.bytes} IS NULL THEN 1 ELSE 0 END)`,
        })
        .from(photo);

      const [countRow] = await db
        .select({ value: count(photo.id) })
        .from(photo);

      const [largestRow] = await db
        .select(photoColumns)
        .from(photo)
        .leftJoin(album, eq(album.id, photo.albumId))
        .where(isNotNull(photo.bytes))
        .orderBy(desc(photo.bytes))
        .limit(1);

      const albumStats = await db
        .select({
          id: album.id,
          title: album.title,
          count: count(photo.id),
          bytes: sql<number | null>`sum(${photo.bytes})`,
        })
        .from(album)
        .leftJoin(photo, eq(photo.albumId, album.id))
        .groupBy(album.id, album.title)
        .orderBy(desc(count(photo.id)), asc(album.title));

      const albumOptions = await db
        .select({ id: album.id, title: album.title })
        .from(album)
        .orderBy(asc(album.title));

      return {
        items: rows.map(toItem),
        total: totalRow?.value ?? 0,
        page: query.page,
        size: query.size,
        stats: {
          count: countRow?.value ?? 0,
          bytes: Number(sumRow?.bytes ?? 0),
          missingBytes: Number(sumRow?.missing ?? 0),
          largest: largestRow ? toItem(largestRow) : null,
        },
        albums: albumStats.map((row) => ({
          id: row.id,
          title: row.title,
          count: Number(row.count ?? 0),
          bytes: row.bytes === null ? null : Number(row.bytes),
        })),
        albumOptions,
      };
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;
