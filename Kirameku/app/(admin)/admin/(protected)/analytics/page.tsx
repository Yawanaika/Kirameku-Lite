import type { Metadata } from "next";
import AnalyticsManager from "@/components/admin/AnalyticsManager";

export const metadata: Metadata = {
  title: "统计 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminAnalyticsPage() {
  return <AnalyticsManager />;
}
