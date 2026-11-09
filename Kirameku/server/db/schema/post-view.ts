import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { post } from "./post";

export const postView = sqliteTable(
  "post_view",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    visitorKey: text("visitor_key").notNull(),
    day: text("day").notNull(),
  },
  (table) => [
    uniqueIndex("uq_post_view_post_visitor_day").on(
      table.postId,
      table.visitorKey,
      table.day,
    ),
    index("idx_post_view_day").on(table.day),
  ],
);
