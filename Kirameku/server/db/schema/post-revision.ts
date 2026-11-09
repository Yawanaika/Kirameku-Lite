import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "./columns";
import { post } from "./post";

export const postRevision = sqliteTable(
  "post_revision",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id").notNull().references(() => post.id, { onDelete: "cascade" }),
    snapshot: text("snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_post_revision_post_created").on(t.postId, t.createdAt)],
);

export const postDraft = sqliteTable("post_draft", {
  postId: integer("post_id").primaryKey().references(() => post.id, { onDelete: "cascade" }),
  snapshot: text("snapshot", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  updatedAt: updatedAt(),
});
