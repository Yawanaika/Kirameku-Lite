import type { Metadata } from "next";
import ChatterEditor from "@/components/admin/ChatterEditor";

export const metadata: Metadata = {
  title: "新建说说 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminNewChatterPage() {
  return <ChatterEditor />;
}
