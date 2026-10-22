import { z } from "zod";

const optionalFilter = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(64).optional(),
);

export const auditListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(30),
  action: optionalFilter,
  targetType: optionalFilter,
});

export type AuditListParams = z.infer<typeof auditListQuery>;

export interface AuditLogItem {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  detail: Record<string, unknown>;
  ip: string;
  created_at: string;
}

export interface AuditLogList {
  items: AuditLogItem[];
  total: number;
}
