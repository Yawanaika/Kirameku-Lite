import type { Metadata } from "next";
import { getBookmarksService } from "@/server/modules/bookmarks";
import { siteConfig } from "@/siteConfig";
import BookmarkClient from "./BookmarkClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: `收藏夹 · ${siteConfig.title}`,
  description: "收集常用的好用站点和工具",
};

export default async function BookmarkPage() {
  const data = await getBookmarksService()
    .list()
    .catch((error) => {
      console.error("Failed to load bookmarks", error);
      return [];
    });

  return <BookmarkClient data={data} />;
}
