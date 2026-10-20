import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "./columns";

export const category = sqliteTable("category", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description").default(""),
  sort: integer("sort").default(0),
  postCount: integer("post_count").default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
