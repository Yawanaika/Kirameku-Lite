import { and, asc, eq, ne } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { project } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type {
  CreateProjectInput,
  ProjectItem,
  UpdateProjectInput,
} from "./contracts";

function parseTechStack(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function toItem(row: typeof project.$inferSelect): ProjectItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    long_description: row.longDescription ?? "",
    cover_image: row.coverImage ?? "",
    tech_stack: parseTechStack(row.techStack),
    link_github: row.linkGithub ?? "",
    link_gitee: row.linkGitee ?? "",
    link_live: row.linkLive ?? "",
    link_docs: row.linkDocs ?? "",
    status: row.status ?? "developing",
    status_label: row.statusLabel ?? "",
    is_featured: row.isFeatured ?? false,
    sort: row.sort ?? 0,
    created_at: row.createdAt?.toISOString() ?? new Date(0).toISOString(),
  };
}

export function createProjectsService(db: AppDatabase) {
  async function getById(id: number): Promise<ProjectItem> {
    const [row] = await db
      .select()
      .from(project)
      .where(eq(project.id, id))
      .limit(1);
    if (!row) throw errors.notFound("项目不存在");
    return toItem(row);
  }

  async function assertSlugUnique(
    slug: string,
    excludeId?: number,
  ): Promise<void> {
    const conditions = [eq(project.slug, slug)];
    if (excludeId !== undefined) conditions.push(ne(project.id, excludeId));

    const [row] = await db
      .select({ id: project.id })
      .from(project)
      .where(and(...conditions))
      .limit(1);
    if (row) throw errors.conflict("项目 slug 已存在");
  }

  return {
    async list(): Promise<ProjectItem[]> {
      const rows = await db
        .select()
        .from(project)
        .orderBy(asc(project.sort), asc(project.id));
      return rows.map(toItem);
    },

    async getBySlug(slug: string): Promise<ProjectItem> {
      const [row] = await db
        .select()
        .from(project)
        .where(eq(project.slug, slug))
        .limit(1);
      if (!row) throw errors.notFound("项目不存在");
      return toItem(row);
    },

    getById,

    async create(input: CreateProjectInput): Promise<ProjectItem> {
      await assertSlugUnique(input.slug);
      const [row] = await db
        .insert(project)
        .values({
          name: input.name,
          slug: input.slug,
          description: input.description,
          longDescription: input.long_description,
          coverImage: input.cover_image,
          techStack: JSON.stringify(input.tech_stack),
          linkGithub: input.link_github,
          linkGitee: input.link_gitee,
          linkLive: input.link_live,
          linkDocs: input.link_docs,
          status: input.status,
          statusLabel: input.status_label,
          isFeatured: input.is_featured,
          sort: input.sort,
        })
        .returning({ id: project.id });
      if (!row) throw errors.internal("保存项目失败");
      return getById(row.id);
    },

    async update(id: number, input: UpdateProjectInput): Promise<ProjectItem> {
      const [existing] = await db
        .select({ id: project.id })
        .from(project)
        .where(eq(project.id, id))
        .limit(1);
      if (!existing) throw errors.notFound("项目不存在");

      if (input.slug !== undefined) {
        await assertSlugUnique(input.slug, id);
      }

      const values: Partial<typeof project.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) values.name = input.name;
      if (input.slug !== undefined) values.slug = input.slug;
      if (input.description !== undefined) {
        values.description = input.description;
      }
      if (input.long_description !== undefined) {
        values.longDescription = input.long_description;
      }
      if (input.cover_image !== undefined) {
        values.coverImage = input.cover_image;
      }
      if (input.tech_stack !== undefined) {
        values.techStack = JSON.stringify(input.tech_stack);
      }
      if (input.link_github !== undefined) {
        values.linkGithub = input.link_github;
      }
      if (input.link_gitee !== undefined) {
        values.linkGitee = input.link_gitee;
      }
      if (input.link_live !== undefined) values.linkLive = input.link_live;
      if (input.link_docs !== undefined) values.linkDocs = input.link_docs;
      if (input.status !== undefined) values.status = input.status;
      if (input.status_label !== undefined) {
        values.statusLabel = input.status_label;
      }
      if (input.is_featured !== undefined) {
        values.isFeatured = input.is_featured;
      }
      if (input.sort !== undefined) values.sort = input.sort;

      const [row] = await db
        .update(project)
        .set(values)
        .where(eq(project.id, id))
        .returning({ id: project.id });
      if (!row) throw errors.notFound("项目不存在");
      return getById(row.id);
    },

    async remove(id: number): Promise<{ ok: true }> {
      const [row] = await db
        .delete(project)
        .where(eq(project.id, id))
        .returning({ id: project.id });
      if (!row) throw errors.notFound("项目不存在");
      return { ok: true };
    },
  };
}

export type ProjectsService = ReturnType<typeof createProjectsService>;
