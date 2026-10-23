-- Notification channels, per-event rules and delivery log.
CREATE TABLE IF NOT EXISTS "notification_channel" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT NOT NULL,
  "enabled" INTEGER DEFAULT 0,
  "config" TEXT DEFAULT '{}',
  "updated_at" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_channel_type_unique"
  ON "notification_channel" ("type");

CREATE TABLE IF NOT EXISTS "notification_rule" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "event_key" TEXT NOT NULL,
  "enabled" INTEGER DEFAULT 0,
  "channels" TEXT DEFAULT '[]',
  "settings" TEXT DEFAULT '{}',
  "cooldown_seconds" INTEGER DEFAULT 1800,
  "last_fired_at" INTEGER,
  "updated_at" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_rule_event_unique"
  ON "notification_rule" ("event_key");

CREATE TABLE IF NOT EXISTS "notification_log" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "event_key" TEXT NOT NULL,
  "level" TEXT DEFAULT 'warning',
  "title" TEXT NOT NULL,
  "body" TEXT DEFAULT '',
  "channel_type" TEXT DEFAULT '',
  "status" TEXT NOT NULL,
  "error" TEXT DEFAULT '',
  "duration_ms" INTEGER,
  "created_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_notification_log_created"
  ON "notification_log" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_notification_log_event"
  ON "notification_log" ("event_key", "created_at" DESC);
