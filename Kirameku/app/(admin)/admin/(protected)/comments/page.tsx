import type { Metadata } from "next";
import CommentsManager from "@/components/admin/CommentsManager";

export const metadata: Metadata = {
  title: "评论 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminCommentsPage() {
  return <CommentsManager />;
}
