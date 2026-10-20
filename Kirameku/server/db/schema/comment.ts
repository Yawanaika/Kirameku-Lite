import {
  type AnySQLiteColumn,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { createdAt } from "./columns";
import { githubUser } from "./github-user";
import { post } from "./post";

export const comment = sqliteTable(
  "comment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    parentId: integer("parent_id").references(
      (): AnySQLiteColumn => comment.id,
      { onDelete: "cascade" },
    ),
    githubUserId: integer("github_user_id").references(() => githubUser.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    likes: integer("likes").default(0),
    ip: text("ip").default(""),
    status: text("status").default("approved"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_comment_post_status_created").on(
      t.postId,
      t.status,
      t.createdAt,
    ),
    index("idx_comment_parent").on(t.parentId),
    index("idx_comment_github_user").on(t.githubUserId),
  ],
);
