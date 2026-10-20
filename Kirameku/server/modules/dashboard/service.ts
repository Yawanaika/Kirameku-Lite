import { count, desc, eq } from "drizzle-orm";
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
        .where(eq(post.status, "published")),
      db
        .select({ value: count() })
        .from(comment)
        .where(eq(comment.status, "pending")),
      db
        .select({ value: count() })
        .from(message)
        .where(eq(message.status, "pending")),
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
        pendingComments: commentRows?.value ?? 0,
        pendingMessages: messageRows?.value ?? 0,
        visitors: visitorRows?.value ?? 0,
      },
      recentPosts,
    };
  },
};
