import type { Metadata } from "next";
import BackupsManager from "@/components/admin/BackupsManager";

export const metadata: Metadata = {
  title: "备份 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminBackupsPage() {
  return <BackupsManager />;
}
