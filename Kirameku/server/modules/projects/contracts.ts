import { z } from "zod";

export const projectSlugParams = z.object({
  slug: z.string().trim().min(1).max(100),
});

export const adminProjectIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

const projectName = z.string().trim().min(1).max(100);
const projectSlug = z.string().trim().min(1).max(100);
const projectDescription = z.string().trim().max(500);
const projectLongDescription = z.string().trim().max(50_000);
const projectCoverImage = z.string().trim().max(500);
const projectTechStack = z.array(z.string().trim().max(100)).max(30);
const projectLink = z.string().trim().max(300);
const projectStatus = z.string().trim().min(1).max(20);
const projectStatusLabel = z.string().trim().max(20);
const projectSort = z.coerce.number().int().min(-1_000_000).max(1_000_000);

export const createProjectInput = z.object({
  name: projectName,
  slug: projectSlug,
  description: projectDescription.default(""),
  long_description: projectLongDescription.default(""),
  cover_image: projectCoverImage.default(""),
  tech_stack: projectTechStack.default([]),
  link_github: projectLink.default(""),
  link_gitee: projectLink.default(""),
  link_live: projectLink.default(""),
  link_docs: projectLink.default(""),
  status: projectStatus.default("developing"),
  status_label: projectStatusLabel.default(""),
  is_featured: z.boolean().default(false),
  sort: projectSort.default(0),
});

export const updateProjectInput = z
  .object({
    name: projectName.optional(),
    slug: projectSlug.optional(),
    description: projectDescription.optional(),
    long_description: projectLongDescription.optional(),
    cover_image: projectCoverImage.optional(),
    tech_stack: projectTechStack.optional(),
    link_github: projectLink.optional(),
    link_gitee: projectLink.optional(),
    link_live: projectLink.optional(),
    link_docs: projectLink.optional(),
    status: projectStatus.optional(),
    status_label: projectStatusLabel.optional(),
    is_featured: z.boolean().optional(),
    sort: projectSort.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少提供一个字段",
  });

export type CreateProjectInput = z.infer<typeof createProjectInput>;
export type UpdateProjectInput = z.infer<typeof updateProjectInput>;

export interface ProjectItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  long_description: string;
  cover_image: string;
  tech_stack: string[];
  link_github: string;
  link_gitee: string;
  link_live: string;
  link_docs: string;
  status: string;
  status_label: string;
  is_featured: boolean;
  sort: number;
  created_at: string;
}
