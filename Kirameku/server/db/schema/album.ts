import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createdAt, updatedAt } from "./columns";

export const album = sqliteTable("album", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").default(""),
  cover: text("cover").default(""),
  photoCount: integer("photo_count").default(0),
  sort: integer("sort").default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const photo = sqliteTable(
  "photo",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    albumId: integer("album_id")
      .notNull()
      .references(() => album.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    caption: text("caption").default(""),
    orientation: text("orientation").default("landscape"),
    sort: integer("sort").default(0),
    createdAt: createdAt(),
    // 上传时已经解析出来的图片元数据。老数据为 NULL：显示「未记录」比填 0 诚实。
    // 声明顺序必须跟在 created_at 后面：SQLite 的 ALTER TABLE 只能把列追加到末尾，
    // migrations.test.ts 会逐列比对 PRAGMA table_info 的顺序。
    width: integer("width"),
    height: integer("height"),
    bytes: integer("bytes"),
    format: text("format"),
  },
  (t) => [index("idx_photo_album").on(t.albumId)],
);
