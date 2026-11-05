/**
 * 全站唯一的时间/时长格式化入口。
 *
 * 之前同一个「3 分钟前」在 4 个组件里各写了一遍，格式还各不相同
 * （0:00 与 00:00、2026.1.5 与 2026-01-05），播放器与时间线对不上。
 * 客户端与服务端都能安全引入本文件（不 import server-only、不读 env）。
 */

const shanghaiDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "medium",
  timeStyle: "short",
});

function toDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 后台风格的完整时间，例如 `2026年1月5日 12:03`。 */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = toDate(value);
  if (!date) return "—";
  return shanghaiDateTimeFormatter.format(date);
}

/** 前台风格的紧凑时间，例如 `2026.1.5 12:03`。 */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = toDate(value);
  if (!date) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 相对时间：超过 `afterDays` 天后回落到 `formatDate`。
 * 未来时间（时钟漂移）按「刚刚」处理，不显示负数。
 */
export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  options: { afterDays?: number } = {},
): string {
  const { afterDays = 7 } = options;
  if (value === null || value === undefined || value === "") return "—";
  const date = toDate(value);
  if (!date) return "—";

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < afterDays) return `${days}天前`;
  return formatDate(date);
}

/**
 * 已有「距今多少秒」时的相对文案，例如 `2 小时前`。
 *
 * 服务端算好的时长直接渲染，不必在组件里调用 `Date.now()`：
 * 渲染期取当前时间是纯函数规则不允许的，也会让 SSR 与客户端对不上。
 */
export function formatElapsed(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return "刚刚";
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

/** 字节数转人类可读体积，例如 `1.2 MB`；无效值返回 `—`。 */
export function formatBytes(
  value: number | null | undefined,
  options: { fractionDigits?: number } = {},
): string {
  const { fractionDigits = 1 } = options;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "—";
  }
  if (value < 1024) return `${Math.round(value)} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(fractionDigits)} ${units[unit]}`;
}

/**
 * 播放进度时长。`padMinutes` 为 true 时输出 `00:00`，否则 `0:00`，
 * 用于统一原本两套互不一致的实现。
 */
export function formatDuration(
  seconds: number | null | undefined,
  options: { padMinutes?: boolean } = {},
): string {
  const { padMinutes = false } = options;
  const total = typeof seconds === "number" && Number.isFinite(seconds) ? seconds : 0;
  if (total <= 0) return padMinutes ? "00:00" : "0:00";
  const minutes = Math.floor(total / 60);
  const rest = Math.floor(total % 60);
  const restText = String(rest).padStart(2, "0");
  return padMinutes
    ? `${String(minutes).padStart(2, "0")}:${restText}`
    : `${minutes}:${restText}`;
}
