-- 站内全文搜索。
--
-- 用 FTS5 的 external content 模式（content = 'post'）：索引里不重复存正文，
-- 只有倒排索引，正文仍然只在 post 表里存一份。注意 external content 表的列名
-- 必须和内容表一一对应（title / description / content），否则 SQLite 会报
-- "no such column"。
--
-- 分词器选 trigram 而不是默认的 unicode61：中文没有空格，unicode61 会把一整段
-- 中文当成一个 token，只有整句完全命中才搜得到；trigram 按三字符切片，
-- 任意长度（>= 3 字符）的子串都能命中，中英混排也一致。
-- 代价是索引比 unicode61 大，对一个个人博客的文章量级无所谓。
--
-- 短于 3 字符的查询（例如两个汉字）trigram 无法走 MATCH，服务层用 LIKE 兜底。
CREATE VIRTUAL TABLE IF NOT EXISTS "post_search" USING fts5(
  "title",
  "description",
  "content",
  content = 'post',
  content_rowid = 'id',
  tokenize = 'trigram'
);

-- 触发器负责让索引跟着 post 走。external content 表不会自己同步。
CREATE TRIGGER IF NOT EXISTS "post_search_ai" AFTER INSERT ON "post" BEGIN
  INSERT INTO "post_search" ("rowid", "title", "description", "content")
  VALUES (
    new."id",
    new."title",
    coalesce(new."description", ''),
    coalesce(new."content", '')
  );
END;

CREATE TRIGGER IF NOT EXISTS "post_search_ad" AFTER DELETE ON "post" BEGIN
  INSERT INTO "post_search" ("post_search", "rowid", "title", "description", "content")
  VALUES (
    'delete',
    old."id",
    old."title",
    coalesce(old."description", ''),
    coalesce(old."content", '')
  );
END;

CREATE TRIGGER IF NOT EXISTS "post_search_au" AFTER UPDATE ON "post" BEGIN
  INSERT INTO "post_search" ("post_search", "rowid", "title", "description", "content")
  VALUES (
    'delete',
    old."id",
    old."title",
    coalesce(old."description", ''),
    coalesce(old."content", '')
  );
  INSERT INTO "post_search" ("rowid", "title", "description", "content")
  VALUES (
    new."id",
    new."title",
    coalesce(new."description", ''),
    coalesce(new."content", '')
  );
END;

-- 回填已有文章：'rebuild' 是 external content 表的重建指令。
INSERT INTO "post_search" ("post_search") VALUES ('rebuild');
