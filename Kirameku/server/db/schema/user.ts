import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { booleanColumn, createdAt, updatedAt } from "./columns";

export const user = sqliteTable("user", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  nickname: text("nickname").default(""),
  avatar: text("avatar").default(""),
  email: text("email").default(""),
  bio: text("bio").default(""),
  isAdmin: booleanColumn("is_admin"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
