import type { Metadata } from "next";
import MessagesManager from "@/components/admin/MessagesManager";

export const metadata: Metadata = {
  title: "留言 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminMessagesPage() {
  return <MessagesManager />;
}
