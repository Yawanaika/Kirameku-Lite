import type { Metadata } from "next";
import AuditLogManager from "@/components/admin/AuditLogManager";

export const metadata: Metadata = {
  title: "操作审计 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminAuditPage() {
  return <AuditLogManager />;
}
