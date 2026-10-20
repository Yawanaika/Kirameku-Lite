import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { category } from "./category";
import { booleanColumn, createdAt, updatedAt } from "./columns";
import { tag } from "./tag";

export const post = sqliteTable(
  "post",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").default(""),
    content: text("content").default(""),
    cover: text("cover").default(""),
    categoryId: integer("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    status: text("status").default("draft"),
    isPinned: booleanColumn("is_pinned"),
    views: integer("views").default(0),
    likes: integer("likes").default(0),
    wordCount: integer("word_count").default(0),
    readingTime: integer("reading_time").default(0),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("idx_post_status_published_at").on(t.status, t.publishedAt),
    index("idx_post_category_status").on(t.categoryId, t.status),
  ],
);

export const postTag = sqliteTable(
  "post_tag",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.tagId] }),
    index("idx_post_tag_tag").on(t.tagId),
  ],
);
