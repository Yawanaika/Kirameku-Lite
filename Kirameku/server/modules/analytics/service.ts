import "server-only";
import { sql } from "drizzle-orm";
import { env } from "@/server/env";
import type { AppDatabase } from "@/server/db/types";
import type {
  AnalyticsBreakdown,
  AnalyticsBucket,
  AnalyticsOverview,
  AnalyticsTotals,
} from "./contracts";

/** 入库与分桶都用这个时区，避免跨零点时「今天」被切成两天。 */
const LOCAL_OFFSET = "+8 hours";
const DAY_MS = 86_400_000;
/** 明细列表最多展示这么多行。 */
const BREAKDOWN_LIMIT = 8;

interface RawBucketRow {
  label: string;
  pv: number;
  uv: number;
}

interface RawKeyRow {
  key: string | null;
  pv: number;
  uv: number;
}

/** 东八区某个时刻的当天 00:00，返回 UTC 毫秒。 */
function startOfLocalDay(date: Date): number {
  const shifted = new Date(date.getTime() + 8 * 3_600_000);
  shifted.setUTCHours(0, 0, 0, 0);
  return shifted.getTime() - 8 * 3_600_000;
}

function localDayLabel(ms: number): string {
  return new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * 把稀疏结果补齐成连续的桶。
 *
 * 折线图缺一天就会把两天连成直线，看起来像流量真的翻倍了；这里显式补 0。
 */
function fillDays(
  rows: RawBucketRow[],
  since: number,
  days: number,
): AnalyticsBucket[] {
  const found = new Map(rows.map((row) => [row.label, row]));
  const buckets: AnalyticsBucket[] = [];
  for (let index = 0; index < days; index += 1) {
    const label = localDayLabel(since + index * DAY_MS);
    const row = found.get(label);
    buckets.push({ label, pv: row?.pv ?? 0, uv: row?.uv ?? 0 });
  }
  return buckets;
}

/** 0–23 点的固定桶，同样补齐，前端可以直接画柱状图。 */
function fillHours(rows: RawBucketRow[]): AnalyticsBucket[] {
  const found = new Map(rows.map((row) => [row.label, row]));
  return Array.from({ length: 24 }, (_, hour) => {
    const label = String(hour).padStart(2, "0");
    const row = found.get(label);
    return { label, pv: row?.pv ?? 0, uv: row?.uv ?? 0 };
  });
}

function toBreakdown(rows: RawKeyRow[], emptyLabel: string): AnalyticsBreakdown[] {
  return rows.map((row) => ({
    key: row.key && row.key.trim() !== "" ? row.key : emptyLabel,
    pv: row.pv,
    uv: row.uv,
  }));
}

export function createAnalyticsService(db: AppDatabase) {
  async function totalsBetween(since: number, until: number): Promise<AnalyticsTotals> {
    const [row] = await db.all<{ pv: number; uv: number }>(sql`
      SELECT count(*) AS pv, count(DISTINCT ip) AS uv
      FROM visitor
      WHERE created_at >= ${since} AND created_at < ${until}
    `);
    return { pv: row?.pv ?? 0, uv: row?.uv ?? 0 };
  }

  return {
    /**
     * 在访客明细上做聚合；不建新表、不额外埋点。
     *
     * 代价是每次翻页都要扫一遍窗口内的行。个人站点的明细量（保留 90 天）
     * 在 SQLite 上是毫秒级，而建物化表要先解决「历史数据从哪来」的问题。
     */
    async overview(days: number): Promise<AnalyticsOverview> {
      const now = Date.now();
      const until = now;
      const since = startOfLocalDay(new Date(now - (days - 1) * DAY_MS));
      const previousSince = since - days * DAY_MS;

      const [dailyRows, hourRows, pageRows, deviceRows, browserRows, countryRows] =
        await Promise.all([
          db.all<RawBucketRow>(sql`
            SELECT date(created_at / 1000, 'unixepoch', ${LOCAL_OFFSET}) AS label,
                   count(*) AS pv,
                   count(DISTINCT ip) AS uv
            FROM visitor
            WHERE created_at >= ${since} AND created_at < ${until}
            GROUP BY label
          `),
          db.all<RawBucketRow>(sql`
            SELECT strftime('%H', created_at / 1000, 'unixepoch', ${LOCAL_OFFSET}) AS label,
                   count(*) AS pv,
                   count(DISTINCT ip) AS uv
            FROM visitor
            WHERE created_at >= ${since} AND created_at < ${until}
            GROUP BY label
          `),
          db.all<RawKeyRow>(sql`
            SELECT path AS key, count(*) AS pv, count(DISTINCT ip) AS uv
            FROM visitor
            WHERE created_at >= ${since} AND created_at < ${until}
            GROUP BY path
            ORDER BY pv DESC
            LIMIT ${BREAKDOWN_LIMIT}
          `),
          db.all<RawKeyRow>(sql`
            SELECT device_type AS key, count(*) AS pv, count(DISTINCT ip) AS uv
            FROM visitor
            WHERE created_at >= ${since} AND created_at < ${until}
            GROUP BY device_type
            ORDER BY pv DESC
            LIMIT ${BREAKDOWN_LIMIT}
          `),
          db.all<RawKeyRow>(sql`
            SELECT browser AS key, count(*) AS pv, count(DISTINCT ip) AS uv
            FROM visitor
            WHERE created_at >= ${since} AND created_at < ${until}
            GROUP BY browser
            ORDER BY pv DESC
            LIMIT ${BREAKDOWN_LIMIT}
          `),
          db.all<RawKeyRow>(sql`
            SELECT country AS key, count(*) AS pv, count(DISTINCT ip) AS uv
            FROM visitor
            WHERE created_at >= ${since} AND created_at < ${until}
            GROUP BY country
            ORDER BY pv DESC
            LIMIT ${BREAKDOWN_LIMIT}
          `),
        ]);

      const [totals, previous] = await Promise.all([
        totalsBetween(since, until),
        totalsBetween(previousSince, since),
      ]);

      return {
        range: {
          days,
          since: new Date(since).toISOString(),
          until: new Date(until).toISOString(),
          retentionDays: env.VISITOR_RETENTION_DAYS,
        },
        totals,
        previous,
        daily: fillDays(dailyRows, since, days),
        hours: fillHours(hourRows),
        topPages: toBreakdown(pageRows, "(未知路径)"),
        devices: toBreakdown(deviceRows, "未知设备"),
        browsers: toBreakdown(browserRows, "未知浏览器"),
        countries: toBreakdown(countryRows, "未知地区"),
      };
    },
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
