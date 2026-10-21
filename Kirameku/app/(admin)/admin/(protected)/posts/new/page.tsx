import type { Metadata } from "next";
import PostEditor from "@/components/admin/PostEditor";

export const metadata: Metadata = {
  title: "新建文章 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminNewPostPage() {
  return <PostEditor />;
}
