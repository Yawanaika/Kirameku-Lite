import { z } from "zod";

export const albumIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

export interface AlbumItem {
  id: number;
  title: string;
  description: string;
  cover: string;
  photo_count: number;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface PhotoItem {
  id: number;
  album_id: number;
  url: string;
  caption: string;
  orientation: string;
  sort: number;
  created_at: string;
}
