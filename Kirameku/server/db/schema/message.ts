import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { createdAt } from "./columns";
import { githubUser } from "./github-user";

export const message = sqliteTable(
  "message",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    githubUserId: integer("github_user_id").references(() => githubUser.id, {
      onDelete: "set null",
    }),
    parentId: integer("parent_id").references(
      (): AnySQLiteColumn => message.id,
      { onDelete: "cascade" },
    ),
    content: text("content").notNull(),
    ip: text("ip").default(""),
    status: text("status").default("approved"),
    likes: integer("likes").default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_message_status_created").on(t.status, t.createdAt),
    index("idx_message_parent").on(t.parentId),
    index("idx_message_github_user").on(t.githubUserId),
  ],
);
