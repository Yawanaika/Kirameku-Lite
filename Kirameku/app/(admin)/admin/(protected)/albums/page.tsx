import type { Metadata } from "next";
import AlbumsManager from "@/components/admin/AlbumsManager";

export const metadata: Metadata = {
  title: "相册 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminAlbumsPage() {
  return <AlbumsManager />;
}
