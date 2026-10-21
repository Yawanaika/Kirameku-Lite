import type { Metadata } from "next";
import SiteConfigManager from "@/components/admin/SiteConfigManager";

export const metadata: Metadata = {
  title: "站点配置 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminSiteConfigPage() {
  return <SiteConfigManager />;
}
