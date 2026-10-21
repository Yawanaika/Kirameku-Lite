import type { Metadata } from "next";
import { getProjectsService } from "@/server/modules/projects";
import { siteConfig } from "@/siteConfig";
import ProjectsClient from "./ProjectsClient";

export const revalidate = 60;

export const metadata: Metadata = {
  title: `项目 · ${siteConfig.title}`,
  description: "从零到一，用代码构建的每一份作品",
};

export default async function ProjectsPage() {
  const projects = await getProjectsService()
    .list()
    .catch((error) => {
      console.error("Failed to load projects", error);
      return [];
    });

  return <ProjectsClient initialProjects={projects} />;
}
