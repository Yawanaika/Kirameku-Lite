import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { updatedAt } from "./columns";

export const siteConfig = sqliteTable("site_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").default(""),
  description: text("description").default(""),
  updatedAt: updatedAt(),
});
