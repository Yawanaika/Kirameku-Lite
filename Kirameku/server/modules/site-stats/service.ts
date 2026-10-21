import { count, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { chatter, photo, post } from "@/server/db/schema";

export interface SiteStats {
  postCount: number;
  chatterCount: number;
  photoCount: number;
}

export function createSiteStatsService(db: AppDatabase) {
  return {
    async get(): Promise<SiteStats> {
      const [postRows, chatterRows, photoRows] = await Promise.all([
        db
          .select({ value: count() })
          .from(post)
          .where(eq(post.status, "published")),
        db
          .select({ value: count() })
          .from(chatter)
          .where(eq(chatter.status, "published")),
        db.select({ value: count() }).from(photo),
      ]);

      return {
        postCount: postRows[0]?.value ?? 0,
        chatterCount: chatterRows[0]?.value ?? 0,
        photoCount: photoRows[0]?.value ?? 0,
      };
    },
  };
}

export type SiteStatsService = ReturnType<typeof createSiteStatsService>;
