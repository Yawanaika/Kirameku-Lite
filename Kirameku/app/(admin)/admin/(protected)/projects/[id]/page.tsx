import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectEditor from "@/components/admin/ProjectEditor";

export const metadata: Metadata = {
  title: "编辑项目 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default async function AdminEditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isInteger(projectId) || projectId < 1) notFound();
  return <ProjectEditor projectId={projectId} />;
}
