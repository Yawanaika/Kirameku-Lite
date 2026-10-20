import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "./columns";

export const bookmarkCategory = sqliteTable("bookmark_category", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  icon: text("icon").default(""),
  description: text("description").default(""),
  sort: integer("sort").default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const bookmarkSite = sqliteTable(
  "bookmark_site",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => bookmarkCategory.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    icon: text("icon").default(""),
    description: text("description").default(""),
    platforms: text("platforms").default("[]"),
    sort: integer("sort").default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_bookmark_site_category").on(t.categoryId)],
);
