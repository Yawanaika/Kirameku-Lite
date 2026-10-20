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
  },
  (t) => [index("idx_photo_album").on(t.albumId)],
);
