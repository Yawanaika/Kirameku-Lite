import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { likeRecord } from "@/server/db/schema";

/** 可点赞的目标类型，与 like_record.target_type 一致。 */
export type LikeTargetType = "post" | "chatter" | "chatter_comment" | "comment" | "message";

export interface LikeInput {
  targetType: LikeTargetType;
  targetId: number;
  /** 去重用的访客散列；缺省时不做去重（内部调用 / 测试）。 */
  visitorKey?: string;
  /** true 表示取消点赞。 */
  unlike?: boolean;
}

/**
 * 点赞记账。
 *
 * 返回值表示「计数器是否应该变化」：
 * - 点赞且此前没记过 → true，同时落一行
 * - 点赞但已经记过 → false（重复点击不再 +1）
 * - 取消且此前记过 → true，同时删掉这行
 * - 取消但没记过 → false，也不会把别人的赞扣掉
 *
 * 唯一索引兜住并发：两个人同时点，只有一个 INSERT 能成功。
 */
export async function applyLike(
  db: AppDatabase,
  input: LikeInput,
): Promise<boolean> {
  const { targetType, targetId, visitorKey } = input;
  if (!visitorKey) return true;

  if (input.unlike) {
    const deleted = await db
      .delete(likeRecord)
      .where(
        and(
          eq(likeRecord.targetType, targetType),
          eq(likeRecord.targetId, targetId),
          eq(likeRecord.visitorKey, visitorKey),
        ),
      )
      .returning({ id: likeRecord.id });
    return deleted.length > 0;
  }

  const inserted = await db
    .insert(likeRecord)
    .values({ targetType, targetId, visitorKey })
    .onConflictDoNothing()
    .returning({ id: likeRecord.id });
  return inserted.length > 0;
}
