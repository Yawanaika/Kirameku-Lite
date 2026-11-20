import { booleanColumn, updatedAt } from "./columns";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/** Single-row configuration for the optional ImgBed upload backend. */
export const imagebedSettings = sqliteTable("imagebed_settings", {
  id: integer("id").primaryKey(),
  enabled: booleanColumn("enabled").notNull(),
  baseUrl: text("base_url").notNull().default(""),
  apiToken: text("api_token").notNull().default(""),
  uploadChannel: text("upload_channel").notNull().default("telegram"),
  uploadFolder: text("upload_folder").notNull().default(""),
  updatedAt: updatedAt().notNull(),
});
