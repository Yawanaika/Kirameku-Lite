import type { Metadata } from "next";
import PostsManager from "@/components/admin/PostsManager";

export const metadata: Metadata = {
  title: "文章 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminPostsPage() {
  return <PostsManager />;
}
