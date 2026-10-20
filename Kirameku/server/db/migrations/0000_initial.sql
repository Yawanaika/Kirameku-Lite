-- Kirameku SQLite baseline.
--
-- This mirrors the 18 tables in Kirameku-backend/init_db.sql, using SQLite
-- affinities. Nullability intentionally follows init_db.sql (many DEFAULT
-- columns are nullable); tighten constraints only after auditing production.
--
-- Timestamps are INTEGER UTC epoch milliseconds.

CREATE TABLE IF NOT EXISTS "user" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "username" TEXT NOT NULL,
  "hashed_password" TEXT NOT NULL,
  "nickname" TEXT DEFAULT '',
  "avatar" TEXT DEFAULT '',
  "email" TEXT DEFAULT '',
  "bio" TEXT DEFAULT '',
  "is_admin" INTEGER DEFAULT 0,
  "created_at" INTEGER,
  "updated_at" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_username_unique" ON "user" ("username");

CREATE TABLE IF NOT EXISTS "category" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT DEFAULT '',
  "sort" INTEGER DEFAULT 0,
  "post_count" INTEGER DEFAULT 0,
  "created_at" INTEGER,
  "updated_at" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "category_name_unique" ON "category" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "category_slug_unique" ON "category" ("slug");

CREATE TABLE IF NOT EXISTS "tag" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "post_count" INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "tag_name_unique" ON "tag" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "tag_slug_unique" ON "tag" ("slug");

CREATE TABLE IF NOT EXISTS "post" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT DEFAULT '',
  "content" TEXT DEFAULT '',
  "cover" TEXT DEFAULT '',
  "category_id" INTEGER REFERENCES "category" ("id") ON DELETE SET NULL,
  "status" TEXT DEFAULT 'draft',
  "is_pinned" INTEGER DEFAULT 0,
  "views" INTEGER DEFAULT 0,
  "likes" INTEGER DEFAULT 0,
  "word_count" INTEGER DEFAULT 0,
  "reading_time" INTEGER DEFAULT 0,
  "published_at" INTEGER,
  "created_at" INTEGER,
  "updated_at" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "post_slug_unique" ON "post" ("slug");
CREATE INDEX IF NOT EXISTS "idx_post_status_published_at"
  ON "post" ("status", "published_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_post_category_status"
  ON "post" ("category_id", "status");

CREATE TABLE IF NOT EXISTS "post_tag" (
  "post_id" INTEGER NOT NULL REFERENCES "post" ("id") ON DELETE CASCADE,
  "tag_id" INTEGER NOT NULL REFERENCES "tag" ("id") ON DELETE CASCADE,
  PRIMARY KEY ("post_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "idx_post_tag_tag" ON "post_tag" ("tag_id");

CREATE TABLE IF NOT EXISTS "github_user" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "github_id" INTEGER NOT NULL,
  "login" TEXT NOT NULL,
  "avatar" TEXT DEFAULT '',
  "bio" TEXT DEFAULT '',
  "created_at" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "github_user_github_id_unique"
  ON "github_user" ("github_id");

CREATE TABLE IF NOT EXISTS "comment" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "post_id" INTEGER NOT NULL REFERENCES "post" ("id") ON DELETE CASCADE,
  "parent_id" INTEGER REFERENCES "comment" ("id") ON DELETE CASCADE,
  "github_user_id" INTEGER REFERENCES "github_user" ("id") ON DELETE SET NULL,
  "content" TEXT NOT NULL,
  "likes" INTEGER DEFAULT 0,
  "ip" TEXT DEFAULT '',
  "status" TEXT DEFAULT 'approved',
  "created_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_comment_post_status_created"
  ON "comment" ("post_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_comment_parent" ON "comment" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_comment_github_user" ON "comment" ("github_user_id");

CREATE TABLE IF NOT EXISTS "message" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "github_user_id" INTEGER REFERENCES "github_user" ("id") ON DELETE SET NULL,
  "parent_id" INTEGER REFERENCES "message" ("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "ip" TEXT DEFAULT '',
  "status" TEXT DEFAULT 'approved',
  "likes" INTEGER DEFAULT 0,
  "created_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_message_status_created"
  ON "message" ("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_message_parent" ON "message" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_message_github_user" ON "message" ("github_user_id");

CREATE TABLE IF NOT EXISTS "chatter" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "content" TEXT NOT NULL,
  "images" TEXT DEFAULT '[]',
  "mood" TEXT DEFAULT '',
  "likes" INTEGER DEFAULT 0,
  "comments_count" INTEGER DEFAULT 0,
  "status" TEXT DEFAULT 'draft',
  "created_at" INTEGER,
  "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_chatter_status_created"
  ON "chatter" ("status", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "chatter_comment" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "chatter_id" INTEGER NOT NULL REFERENCES "chatter" ("id") ON DELETE CASCADE,
  "parent_id" INTEGER REFERENCES "chatter_comment" ("id") ON DELETE CASCADE,
  "github_user_id" INTEGER REFERENCES "github_user" ("id") ON DELETE SET NULL,
  "content" TEXT NOT NULL,
  "ip" TEXT DEFAULT '',
  "likes" INTEGER DEFAULT 0,
  "status" TEXT DEFAULT 'approved',
  "created_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_chatter_comment_chatter_status"
  ON "chatter_comment" ("chatter_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_chatter_comment_github_user"
  ON "chatter_comment" ("github_user_id");

CREATE TABLE IF NOT EXISTS "album" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "description" TEXT DEFAULT '',
  "cover" TEXT DEFAULT '',
  "photo_count" INTEGER DEFAULT 0,
  "sort" INTEGER DEFAULT 0,
  "created_at" INTEGER,
  "updated_at" INTEGER
);

CREATE TABLE IF NOT EXISTS "photo" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "album_id" INTEGER NOT NULL REFERENCES "album" ("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL,
  "caption" TEXT DEFAULT '',
  "orientation" TEXT DEFAULT 'landscape',
  "sort" INTEGER DEFAULT 0,
  "created_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_photo_album" ON "photo" ("album_id");

CREATE TABLE IF NOT EXISTS "project" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT DEFAULT '',
  "long_description" TEXT DEFAULT '',
  "cover_image" TEXT DEFAULT '',
  "tech_stack" TEXT DEFAULT '[]',
  "link_github" TEXT DEFAULT '',
  "link_gitee" TEXT DEFAULT '',
  "link_live" TEXT DEFAULT '',
  "link_docs" TEXT DEFAULT '',
  "status" TEXT DEFAULT 'developing',
  "status_label" TEXT DEFAULT '',
  "is_featured" INTEGER DEFAULT 0,
  "sort" INTEGER DEFAULT 0,
  "created_at" INTEGER,
  "updated_at" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_slug_unique" ON "project" ("slug");

CREATE TABLE IF NOT EXISTS "friend_link" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "avatar" TEXT DEFAULT '',
  "description" TEXT DEFAULT '',
  "sort" INTEGER DEFAULT 0,
  "is_approved" INTEGER DEFAULT 0,
  "created_at" INTEGER,
  "updated_at" INTEGER
);

CREATE TABLE IF NOT EXISTS "bookmark_category" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "icon" TEXT DEFAULT '',
  "description" TEXT DEFAULT '',
  "sort" INTEGER DEFAULT 0,
  "created_at" INTEGER,
  "updated_at" INTEGER
);

CREATE TABLE IF NOT EXISTS "bookmark_site" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "category_id" INTEGER NOT NULL REFERENCES "bookmark_category" ("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "icon" TEXT DEFAULT '',
  "description" TEXT DEFAULT '',
  "platforms" TEXT DEFAULT '[]',
  "sort" INTEGER DEFAULT 0,
  "created_at" INTEGER,
  "updated_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_bookmark_site_category"
  ON "bookmark_site" ("category_id");

CREATE TABLE IF NOT EXISTS "site_config" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "key" TEXT NOT NULL,
  "value" TEXT DEFAULT '',
  "description" TEXT DEFAULT '',
  "updated_at" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "site_config_key_unique" ON "site_config" ("key");

CREATE TABLE IF NOT EXISTS "visitor" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "ip" TEXT NOT NULL,
  "path" TEXT DEFAULT '',
  "user_agent" TEXT DEFAULT '',
  "city" TEXT DEFAULT '',
  "region" TEXT DEFAULT '',
  "country" TEXT DEFAULT '',
  "district" TEXT DEFAULT '',
  "org" TEXT DEFAULT '',
  "asn" TEXT DEFAULT '',
  "is_mobile" INTEGER DEFAULT 0,
  "is_proxy" INTEGER DEFAULT 0,
  "is_hosting" INTEGER DEFAULT 0,
  "browser" TEXT DEFAULT '',
  "os" TEXT DEFAULT '',
  "device_type" TEXT DEFAULT '',
  "created_at" INTEGER
);

CREATE INDEX IF NOT EXISTS "idx_visitor_ip" ON "visitor" ("ip");
CREATE INDEX IF NOT EXISTS "idx_visitor_created" ON "visitor" ("created_at" DESC);

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "actor_id" INTEGER,
  "action" TEXT NOT NULL,
  "target_type" TEXT DEFAULT '',
  "target_id" TEXT DEFAULT '',
  "detail" TEXT DEFAULT '{}',
  "ip" TEXT DEFAULT '',
  "created_at" INTEGER NOT NULL
);
