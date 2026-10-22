import type { Metadata } from "next";
import type { Album } from "@/components/photos/AlbumCard";
import type { Photo } from "@/data/photos";
import { getAlbumsService } from "@/server/modules/albums";
import { siteConfig } from "@/siteConfig";
import PhotoWallClient from "./PhotoWallClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: `照片墙 · ${siteConfig.title}`,
  description: "用照片记录生活的每一个瞬间",
};

async function loadAlbums(): Promise<Album[]> {
  const service = getAlbumsService();
  const albumList = await service.list();
  albumList.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return Promise.all(
    albumList.map(async (album) => {
      const photos = await service.listPhotos(album.id);
      return {
        id: album.id,
        title: album.title,
        updatedAt: album.updated_at,
        photoCount: album.photo_count,
        photos: photos
          .slice()
          .reverse()
          .map(
            (photo): Photo => ({
              id: String(photo.id),
              url: photo.url,
              caption: photo.caption,
              orientation:
                (photo.orientation as Photo["orientation"]) || "landscape",
            }),
          ),
      };
    }),
  );
}

export default async function PhotoWallPage() {
  const albums = await loadAlbums().catch((error) => {
    console.error("Failed to load photo albums", error);
    return [];
  });

  return <PhotoWallClient albums={albums} />;
}
