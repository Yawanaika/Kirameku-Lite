import type { Metadata } from "next";
import BookmarksManager from "@/components/admin/BookmarksManager";

export const metadata: Metadata = {
  title: "收藏夹 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminBookmarksPage() {
  return <BookmarksManager />;
}
