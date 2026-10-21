import type { Metadata } from "next";
import FriendLinksManager from "@/components/admin/FriendLinksManager";

export const metadata: Metadata = {
  title: "友链 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminFriendLinksPage() {
  return <FriendLinksManager />;
}
