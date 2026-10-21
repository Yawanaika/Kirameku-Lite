import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AlbumEditor from "@/components/admin/AlbumEditor";

export const metadata: Metadata = {
  title: "相册详情 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const albumId = Number(id);
  if (!Number.isInteger(albumId) || albumId < 1) notFound();
  return <AlbumEditor key={albumId} albumId={albumId} />;
}
