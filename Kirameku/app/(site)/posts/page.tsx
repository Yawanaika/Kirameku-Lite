import type { Metadata } from "next";
import { getCategoriesService } from "@/server/modules/categories";
import { getPostsService } from "@/server/modules/posts";
import { siteConfig } from "@/siteConfig";
import PostsClient from "./PostsClient";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `文章 · ${siteConfig.title}`,
  description: "记录技术探索、学术研究与生活感悟",
};

const PAGE_SIZE = 12;

export default async function PostsPage() {
  const [categories, posts] = await Promise.all([
    getCategoriesService()
      .list()
      .catch((error) => {
        console.error("Failed to load post categories", error);
        return [];
      }),
    getPostsService()
      .list({ status: "published", page: 1, size: PAGE_SIZE })
      .catch((error) => {
        console.error("Failed to load posts", error);
        return [];
      }),
  ]);

  return (
    <PostsClient initialCategories={categories} initialPosts={posts} />
  );
}
