import type { Metadata } from "next";
import TaxonomyManager from "@/components/admin/TaxonomyManager";

export const metadata: Metadata = {
  title: "分类 / 标签 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminTaxonomyPage() {
  return <TaxonomyManager />;
}
