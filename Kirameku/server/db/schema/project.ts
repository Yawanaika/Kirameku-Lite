import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { booleanColumn, createdAt, updatedAt } from "./columns";

export const project = sqliteTable("project", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").default(""),
  longDescription: text("long_description").default(""),
  coverImage: text("cover_image").default(""),
  techStack: text("tech_stack").default("[]"),
  linkGithub: text("link_github").default(""),
  linkGitee: text("link_gitee").default(""),
  linkLive: text("link_live").default(""),
  linkDocs: text("link_docs").default(""),
  status: text("status").default("developing"),
  statusLabel: text("status_label").default(""),
  isFeatured: booleanColumn("is_featured"),
  sort: integer("sort").default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
