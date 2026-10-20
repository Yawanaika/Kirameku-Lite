import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { booleanColumn, createdAt, updatedAt } from "./columns";

export const friendLink = sqliteTable("friend_link", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  avatar: text("avatar").default(""),
  description: text("description").default(""),
  sort: integer("sort").default(0),
  isApproved: booleanColumn("is_approved"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
