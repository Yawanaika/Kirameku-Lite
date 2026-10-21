import type { Metadata } from "next";
import ChattersManager from "@/components/admin/ChattersManager";

export const metadata: Metadata = {
  title: "说说 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminChattersPage() {
  return <ChattersManager />;
}
