import type { Metadata } from "next";
import { getProjectsService } from "@/server/modules/projects";
import { loadSiteSettings } from "@/server/modules/site-settings";
import ProjectsClient from "./ProjectsClient";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await loadSiteSettings();

  return {
    title: `项目 · ${profile.siteTitle}`,
    description: "从零到一，用代码构建的每一份作品",
  };
}

export default async function ProjectsPage() {
  const projects = await getProjectsService()
    .list()
    .catch((error) => {
      console.error("Failed to load projects", error);
      return [];
    });

  return <ProjectsClient initialProjects={projects} />;
}
