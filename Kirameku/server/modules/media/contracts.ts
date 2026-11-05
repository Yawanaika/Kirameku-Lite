import { z } from "zod";

/**
 * 媒体库排序：
 * - `size`：体积从大到小，用来找出真正拖慢首屏的巨图（未记录体积的排在最后）；
 * - `recent`：入库时间从新到旧。
 */
export const MEDIA_SORTS = ["size", "recent"] as const;

export const mediaListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(24),
  sort: z.enum(MEDIA_SORTS).default("size"),
  albumId: z.coerce.number().int().min(1).optional(),
});

export type MediaSort = (typeof MEDIA_SORTS)[number];
export type MediaListQuery = z.infer<typeof mediaListQuery>;

export interface MediaAlbumRef {
  id: number;
  title: string;
}

export interface MediaItem {
  id: number;
  url: string;
  caption: string;
  album_id: number;
  album_title: string;
  orientation: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  format: string | null;
  /** photo.created_at 可空（历史数据可能没有），不要用 1970 冒充。 */
  created_at: string | null;
}

export interface MediaAlbumStat {
  id: number;
  title: string;
  count: number;
  bytes: number | null;
}

export interface MediaOverview {
  items: MediaItem[];
  total: number;
  page: number;
  size: number;
  /** 全站照片统计，不受当前分页与筛选影响。 */
  stats: {
    count: number;
    /** 已记录体积的照片才算进总和；未记录的单独计数。 */
    bytes: number;
    missingBytes: number;
    largest: MediaItem | null;
  };
  albums: MediaAlbumStat[];
  /** 筛选用的相册下拉项。 */
  albumOptions: MediaAlbumRef[];
}
