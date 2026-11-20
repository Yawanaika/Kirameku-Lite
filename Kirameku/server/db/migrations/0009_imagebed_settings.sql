CREATE TABLE "imagebed_settings" (
  "id" INTEGER PRIMARY KEY NOT NULL CHECK ("id" = 1),
  "enabled" INTEGER NOT NULL DEFAULT 0 CHECK ("enabled" IN (0, 1)),
  "base_url" TEXT NOT NULL DEFAULT '',
  "api_token" TEXT NOT NULL DEFAULT '',
  "upload_channel" TEXT NOT NULL DEFAULT 'telegram' CHECK ("upload_channel" = 'telegram'),
  "upload_folder" TEXT NOT NULL DEFAULT '',
  "updated_at" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "imagebed_settings" ("id") VALUES (1);
