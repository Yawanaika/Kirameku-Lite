import type { Metadata } from "next";
import { getPostsService } from "@/server/modules/posts";
import { siteConfig } from "@/siteConfig";
import TimelineClient from "./TimelineClient";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `归档 · ${siteConfig.title}`,
  description: "时光河流 · 记录每一个瞬间",
};

export default async function TimelinePage() {
  const posts = await getPostsService()
    .list({ status: "published", page: 1, size: 200 })
    .catch((error) => {
      console.error("Failed to load posts for timeline", error);
      return [];
    });

  return <TimelineClient posts={posts} />;
}
