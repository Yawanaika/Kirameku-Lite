import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tag = sqliteTable("tag", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  postCount: integer("post_count").default(0),
});
