import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "./columns";
import { githubUser } from "./github-user";

export const chatter = sqliteTable(
  "chatter",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    content: text("content").notNull(),
    images: text("images").default("[]"),
    mood: text("mood").default(""),
    likes: integer("likes").default(0),
    commentsCount: integer("comments_count").default(0),
    status: text("status").default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("idx_chatter_status_created").on(t.status, t.createdAt)],
);

export const chatterComment = sqliteTable(
  "chatter_comment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chatterId: integer("chatter_id")
      .notNull()
      .references(() => chatter.id, { onDelete: "cascade" }),
    parentId: integer("parent_id").references(
      (): AnySQLiteColumn => chatterComment.id,
      { onDelete: "cascade" },
    ),
    githubUserId: integer("github_user_id").references(() => githubUser.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    ip: text("ip").default(""),
    likes: integer("likes").default(0),
    status: text("status").default("approved"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_chatter_comment_chatter_status").on(
      t.chatterId,
      t.status,
      t.createdAt,
    ),
    index("idx_chatter_comment_github_user").on(t.githubUserId),
  ],
);
