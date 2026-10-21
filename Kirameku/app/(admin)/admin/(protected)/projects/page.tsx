import type { Metadata } from "next";
import ProjectsManager from "@/components/admin/ProjectsManager";

export const metadata: Metadata = {
  title: "项目 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminProjectsPage() {
  return <ProjectsManager />;
}
