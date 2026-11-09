import { formatDateTime } from "@/lib/format";

/**
 * 后台格式化工具的统一出口。时间格式化本身已经收敛到 `lib/format.ts`，
 * 这里只保留后台专属的状态文案映射，避免前后台各自维护一份日期实现。
 */
export { formatDateTime };

const statusLabels: Record<string, string> = {
  published: "已发布",
  draft: "草稿",
  approved: "已通过",
  rejected: "已拒绝",
  active: "维护中",
  developing: "开发中",
  archived: "已归档",
  pending: "待发布",
  scheduled: "定时发布",
  unpublish_scheduled: "定时下架",
};

export function statusLabel(status: string, fallback?: string): string {
  if (fallback) return fallback;
  return statusLabels[status] ?? status;
}
