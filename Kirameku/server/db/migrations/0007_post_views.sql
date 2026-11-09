-- 浏览去重记录与浏览量在同一事务提交，避免失败请求提前消耗配额。
CREATE TABLE "post_view" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "post_id" INTEGER NOT NULL REFERENCES "post"("id") ON DELETE CASCADE,
  "visitor_key" TEXT NOT NULL,
  "day" TEXT NOT NULL
);

CREATE UNIQUE INDEX "uq_post_view_post_visitor_day"
  ON "post_view" ("post_id", "visitor_key", "day");
CREATE INDEX "idx_post_view_day" ON "post_view" ("day");
