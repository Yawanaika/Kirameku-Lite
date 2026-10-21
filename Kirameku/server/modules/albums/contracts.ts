import { z } from "zod";

const albumTitle = z.string().trim().min(1).max(200);
const albumDescription = z.string().trim().max(5000);
const albumCover = z.string().trim().max(500);
const albumSort = z.coerce.number().int().min(0).max(1_000_000);

export const albumIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

export const createAlbumInput = z.object({
  title: albumTitle,
  description: albumDescription.default(""),
  cover: albumCover.default(""),
  sort: albumSort.default(0),
});

export const updateAlbumInput = z
  .object({
    title: albumTitle.optional(),
    description: albumDescription.optional(),
    cover: albumCover.optional(),
    sort: albumSort.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个字段",
  });

export const createPhotoInput = z.object({
  album_id: z.coerce.number().int().min(1),
  url: z.string().trim().min(1).max(1000),
  caption: z.string().trim().max(1000).default(""),
  orientation: z.enum(["landscape", "portrait"]).default("landscape"),
  sort: albumSort.default(0),
});

export const photoIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

export type CreateAlbumInput = z.infer<typeof createAlbumInput>;
export type UpdateAlbumInput = z.infer<typeof updateAlbumInput>;
export type CreatePhotoInput = z.infer<typeof createPhotoInput>;

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
