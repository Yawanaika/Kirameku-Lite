import "server-only";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { adminAuditLog, user } from "@/server/db/schema";
import type {
  AuditListParams,
  AuditLogItem,
  AuditLogList,
} from "./contracts";

export interface RecordAuditInput {
  actorId?: number | null;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  ip?: string;
}

function parseDetail(value: string | null): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Keep malformed legacy detail visible without breaking the list.
  }

  return { raw: value };
}

export function createAuditService(db: AppDatabase) {
  return {
    async record(input: RecordAuditInput): Promise<void> {
      await db.insert(adminAuditLog).values({
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType ?? "",
        targetId: input.targetId ?? "",
        detail: JSON.stringify(input.detail ?? {}),
        ip: input.ip ?? "",
      });
    },

    async list(params: AuditListParams): Promise<AuditLogList> {
      const conditions: SQL[] = [];
      if (params.action) {
        conditions.push(eq(adminAuditLog.action, params.action));
      }
      if (params.targetType) {
        conditions.push(eq(adminAuditLog.targetType, params.targetType));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, totals] = await Promise.all([
        db
          .select({
            id: adminAuditLog.id,
            actorId: adminAuditLog.actorId,
            actorName: user.username,
            action: adminAuditLog.action,
            targetType: adminAuditLog.targetType,
            targetId: adminAuditLog.targetId,
            detail: adminAuditLog.detail,
            ip: adminAuditLog.ip,
            createdAt: adminAuditLog.createdAt,
          })
          .from(adminAuditLog)
          .leftJoin(user, eq(adminAuditLog.actorId, user.id))
          .where(where)
          .orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
          .limit(params.size)
          .offset((params.page - 1) * params.size),
        db.select({ value: count() }).from(adminAuditLog).where(where),
      ]);

      const items: AuditLogItem[] = rows.map((row) => ({
        id: row.id,
        actor_id: row.actorId,
        actor_name:
          row.actorName ??
          (row.actorId === null ? "系统" : "已删除管理员"),
        action: row.action,
        target_type: row.targetType ?? "",
        target_id: row.targetId ?? "",
        detail: parseDetail(row.detail),
        ip: row.ip ?? "",
        created_at: row.createdAt.toISOString(),
      }));

      return { items, total: totals[0]?.value ?? 0 };
    },
  };
}
