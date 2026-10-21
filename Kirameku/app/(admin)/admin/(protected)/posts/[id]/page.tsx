import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PostEditor from "@/components/admin/PostEditor";

export const metadata: Metadata = {
  title: "编辑文章 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default async function AdminEditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId) || postId < 1) notFound();
  return <PostEditor postId={postId} />;
}
