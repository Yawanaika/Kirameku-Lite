import type { Metadata } from "next";
import { getPostsService } from "@/server/modules/posts";
import { loadSiteSettings } from "@/server/modules/site-settings";
import TimelineClient from "./TimelineClient";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await loadSiteSettings();

  return {
    title: `归档 · ${profile.siteTitle}`,
    description: "时光河流 · 记录每一个瞬间",
  };
}

export default async function TimelinePage() {
  const posts = await getPostsService()
    .list({ status: "published", page: 1, size: 200 })
    .catch((error) => {
      console.error("Failed to load posts for timeline", error);
      return [];
    });

  return <TimelineClient posts={posts} />;
}
