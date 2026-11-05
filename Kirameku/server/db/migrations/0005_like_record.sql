-- 点赞去重凭据：同一访客对同一目标只计一次。
-- 计数器只做 +1/-1，本身不带来源信息，清掉 localStorage 就能无限刷；
-- 这里按「目标 + 访客散列」记一行，插入成功才加、删除成功才减。
CREATE TABLE IF NOT EXISTS "like_record" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "target_type" TEXT NOT NULL,
  "target_id" INTEGER NOT NULL,
  "visitor_key" TEXT NOT NULL,
  "created_at" INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_like_record_unique"
  ON "like_record" ("target_type", "target_id", "visitor_key");

-- 按时间清理用。
CREATE INDEX IF NOT EXISTS "idx_like_record_created"
  ON "like_record" ("created_at");
