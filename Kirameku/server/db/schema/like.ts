import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createdAt } from "./columns";

/**
 * 点赞凭据。
 *
 * 计数器本身只是 post.likes 这类列上的 +1/-1，没有任何来源信息，
 * 所以任何人清掉 localStorage 或者直接打接口就能无限刷。
 * 这张表按「目标 + 访客」记一行：插入成功才 +1，删除成功才 -1，
 * 同一个访客对同一个目标反复点等于没点。
 *
 * visitor_key 不是身份认证，只是去重用的散列（IP + User-Agent +
 * Accept-Language），同一出口 IP 下的两个人可能撞在一起——这只是
 * 少算一次赞，不会误伤到不能点赞。
 */
export const likeRecord = sqliteTable(
  "like_record",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    targetType: text("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    visitorKey: text("visitor_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("idx_like_record_unique").on(
      t.targetType,
      t.targetId,
      t.visitorKey,
    ),
    index("idx_like_record_created").on(t.createdAt),
  ],
);
