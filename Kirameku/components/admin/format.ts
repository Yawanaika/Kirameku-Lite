const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

const statusLabels: Record<string, string> = {
  published: "已发布",
  draft: "草稿",
  approved: "已通过",
  pending: "待审核",
  rejected: "已拒绝",
  active: "维护中",
  developing: "开发中",
  archived: "已归档",
};

export function statusLabel(status: string, fallback?: string): string {
  if (fallback) return fallback;
  return statusLabels[status] ?? status;
}
