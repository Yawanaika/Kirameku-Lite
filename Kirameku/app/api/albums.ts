import { request } from "./client";

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

// Read-only path until album admin writes move off the legacy API. Keeping the
// local handler off /api/albums preserves the legacy POST/PUT/DELETE fallbacks.
export function getAlbums() {
  return request<AlbumItem[]>("/api/albums/list");
}

export function getAlbumById(albumId: number) {
  return request<AlbumItem>(`/api/albums/${albumId}`);
}

export function getAlbumPhotos(albumId: number) {
  return request<PhotoItem[]>(`/api/albums/${albumId}/photos`);
}
