import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt } from "./columns";

export const githubUser = sqliteTable("github_user", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  githubId: integer("github_id").notNull().unique(),
  login: text("login").notNull(),
  avatar: text("avatar").default(""),
  bio: text("bio").default(""),
  createdAt: createdAt(),
});
