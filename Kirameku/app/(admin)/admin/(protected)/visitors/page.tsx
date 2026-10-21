import type { Metadata } from "next";
import VisitorsManager from "@/components/admin/VisitorsManager";

export const metadata: Metadata = {
  title: "访客 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminVisitorsPage() {
  return <VisitorsManager />;
}
