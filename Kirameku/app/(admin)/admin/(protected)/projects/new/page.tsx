import type { Metadata } from "next";
import ProjectEditor from "@/components/admin/ProjectEditor";

export const metadata: Metadata = {
  title: "新建项目 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export default function AdminNewProjectPage() {
  return <ProjectEditor />;
}
