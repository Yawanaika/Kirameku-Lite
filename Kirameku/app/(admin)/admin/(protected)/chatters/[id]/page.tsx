import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ChatterEditor from "@/components/admin/ChatterEditor";

export const metadata: Metadata = {
  title: "编辑说说 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default async function AdminEditChatterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chatterId = Number(id);
  if (!Number.isInteger(chatterId) || chatterId < 1) notFound();
  return <ChatterEditor chatterId={chatterId} />;
}
