import type { Metadata } from "next";
import MediaManager from "@/components/admin/MediaManager";

export const metadata: Metadata = {
  title: "媒体库 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminMediaPage() {
  return <MediaManager />;
}
