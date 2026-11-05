import { z } from "zod";

/**
 * 访问统计的范围：1–90 天，默认 7 天。
 *
 * 上限 90 与 `VISITOR_RETENTION_DAYS` 的默认值一致——访客明细按天清理，
 * 问更早的数据也不会有行。
 */
export const analyticsQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuery>;

/** 一天（或一小时）的访问量。uv 按 ip 去重，与明细表口径一致。 */
export interface AnalyticsBucket {
  /** `2026-11-05` 或 `09`。 */
  label: string;
  pv: number;
  uv: number;
}

export interface AnalyticsTotals {
  pv: number;
  uv: number;
}

/** 页面 / 设备 / 浏览器 / 国家这类维度的分组结果。 */
export interface AnalyticsBreakdown {
  key: string;
  pv: number;
  uv: number;
}

export interface AnalyticsOverview {
  range: {
    days: number;
    /** 统计窗口的起点（ISO 8601，东八区当天 00:00）。 */
    since: string;
    until: string;
    /** 访客明细的保留天数，超过就查不到了。 */
    retentionDays: number;
  };
  totals: AnalyticsTotals;
  /** 与上一个等长窗口对比，前端用来算涨跌。 */
  previous: AnalyticsTotals;
  daily: AnalyticsBucket[];
  hours: AnalyticsBucket[];
  topPages: AnalyticsBreakdown[];
  devices: AnalyticsBreakdown[];
  browsers: AnalyticsBreakdown[];
  countries: AnalyticsBreakdown[];
}
