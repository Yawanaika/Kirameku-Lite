import type { Metadata } from "next";
import NotificationsManager from "@/components/admin/NotificationsManager";

export const metadata: Metadata = {
  title: "预警通知 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminNotificationsPage() {
  return <NotificationsManager />;
}
