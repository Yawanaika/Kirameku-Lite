import { count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { comment, message, post, visitor } from "@/server/db/schema";

export const dashboardService = {
  async stats() {
    const db = getDb();
    const [
      [postRows],
      [commentRows],
      [messageRows],
      [visitorRows],
      recentPosts,
    ] = await Promise.all([
      db
        .select({ value: count() })
        .from(post)
        .where(inArray(post.status, ["published", "unpublish_scheduled"])),
      // 评论/留言入库即 approved，后台只会在 approved 与 rejected 间切换，
      // 所以这里统计「已通过」而不是永远不会增长的「待审核」。
      db
        .select({ value: count() })
        .from(comment)
        .where(eq(comment.status, "approved")),
      db
        .select({ value: count() })
        .from(message)
        .where(eq(message.status, "approved")),
      db.select({ value: count() }).from(visitor),
      db
        .select({
          id: post.id,
          title: post.title,
          status: post.status,
          views: post.views,
          publishedAt: post.publishedAt,
        })
        .from(post)
        .orderBy(desc(post.updatedAt), desc(post.id))
        .limit(5),
    ]);

    return {
      counts: {
        posts: postRows?.value ?? 0,
        approvedComments: commentRows?.value ?? 0,
        approvedMessages: messageRows?.value ?? 0,
        visitors: visitorRows?.value ?? 0,
      },
      recentPosts,
    };
  },
};
