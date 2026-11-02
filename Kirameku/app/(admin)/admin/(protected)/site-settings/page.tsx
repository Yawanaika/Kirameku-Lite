import type { Metadata } from "next";
import SiteSettingsManager from "@/components/admin/SiteSettingsManager";

export const metadata: Metadata = {
  title: "站点设置 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminSiteSettingsPage() {
  return <SiteSettingsManager />;
}
