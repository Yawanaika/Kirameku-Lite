import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const adminAuditLog = sqliteTable("admin_audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: integer("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type").default(""),
  targetId: text("target_id").default(""),
  detail: text("detail").default("{}"),
  ip: text("ip").default(""),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
