import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { booleanColumn, createdAt, updatedAt } from "./columns";

/**
 * One row per delivery channel (telegram / email / webhook). `config` is a
 * JSON object whose secret fields are stored encrypted (see
 * server/modules/notifications/secrets.ts).
 */
export const notificationChannel = sqliteTable(
  "notification_channel",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").notNull(),
    enabled: booleanColumn("enabled"),
    config: text("config").default("{}"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("notification_channel_type_unique").on(t.type)],
);

/**
 * Per-event switch: which channels receive it, the cooldown between repeats
 * and the thresholds used by the ops checks.
 */
export const notificationRule = sqliteTable(
  "notification_rule",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventKey: text("event_key").notNull(),
    enabled: booleanColumn("enabled"),
    /** JSON array of channel types, e.g. ["telegram","webhook"]. */
    channels: text("channels").default("[]"),
    /** JSON object of threshold overrides keyed by catalog threshold key. */
    settings: text("settings").default("{}"),
    cooldownSeconds: integer("cooldown_seconds").default(1800),
    lastFiredAt: integer("last_fired_at", { mode: "timestamp_ms" }),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("notification_rule_event_unique").on(t.eventKey)],
);

/** Delivery audit trail: one row per channel attempt. */
export const notificationLog = sqliteTable(
  "notification_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventKey: text("event_key").notNull(),
    level: text("level").default("warning"),
    title: text("title").notNull(),
    body: text("body").default(""),
    channelType: text("channel_type").default(""),
    status: text("status").notNull(),
    error: text("error").default(""),
    durationMs: integer("duration_ms"),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_notification_log_created").on(t.createdAt),
    index("idx_notification_log_event").on(t.eventKey, t.createdAt),
  ],
);
