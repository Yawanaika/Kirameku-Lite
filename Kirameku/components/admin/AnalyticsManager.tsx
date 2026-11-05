"use client";

import { useState } from "react";
import { Eye, MousePointerClick, RefreshCw, TrendingDown, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminEmptyState from "./AdminEmptyState";
import AdminError from "./AdminError";
import AdminPageHeader from "./AdminPageHeader";
import { useAdminData } from "./use-admin-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  AnalyticsBreakdown,
  AnalyticsOverview,
} from "@/server/modules/analytics/contracts";

const RANGES = [
  { days: 7, label: "近 7 天" },
  { days: 30, label: "近 30 天" },
  { days: 90, label: "近 90 天" },
] as const;

const CHART_PV = "#38bdf8";
const CHART_UV = "#a78bfa";

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Eye;
  /**
   * 与上一等长窗口相比的百分比。
   * `undefined` = 这张卡片不比较；`null` = 上期没有数据，涨跌无意义。
   */
  delta?: number | null;
}) {
  const up = typeof delta === "number" && delta >= 0;

  return (
    <Card>
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{label}</span>
          <Icon className="size-4 text-slate-400" aria-hidden />
        </div>
        <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {value}
        </p>
        <div className="flex h-4 items-center gap-2">
          {typeof delta === "number" ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium",
                delta === 0
                  ? "text-slate-500"
                  : up
                    ? "text-emerald-500"
                    : "text-rose-500",
              )}
            >
              {delta === 0 ? null : up ? (
                <TrendingUp className="size-3" aria-hidden />
              ) : (
                <TrendingDown className="size-3" aria-hidden />
              )}
              {up ? "+" : ""}
              {delta}%
            </span>
          ) : null}
          <span className="text-[11px] text-slate-500">
            {delta === null ? "上期无数据" : hint}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** 分布类维度用条形占比展示：比饼图更容易比较同一维度里的长短。 */
function BreakdownCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: AnalyticsBreakdown[];
  total: number;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500">这个区间没有数据。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.map((row) => {
          const ratio = total > 0 ? row.pv / total : 0;
          return (
            <div key={row.key} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span
                  className="max-w-[65%] truncate text-slate-700 dark:text-slate-300"
                  title={row.key}
                >
                  {row.key}
                </span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {row.pv}
                  <span className="ml-1 text-[10px] text-slate-400">
                    {Math.round(ratio * 100)}%
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-sky-500/80"
                  style={{ width: `${Math.max(ratio * 100, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsManager() {
  const [days, setDays] = useState<number>(7);
  const path = `/api/admin/analytics?days=${days}`;
  const { data, loading, error, reload } = useAdminData<AnalyticsOverview>(path);

  const pvDelta = data ? percentChange(data.totals.pv, data.previous.pv) : null;
  const uvDelta = data ? percentChange(data.totals.uv, data.previous.uv) : null;
  const perVisitor =
    data && data.totals.uv > 0
      ? (data.totals.pv / data.totals.uv).toFixed(1)
      : "—";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Analytics"
        title="访问统计"
        description="数据来自访客明细表，按东八区分日聚合；不额外埋点。"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-200/70 p-0.5 dark:border-white/10">
              {RANGES.map((range) => (
                <button
                  key={range.days}
                  type="button"
                  onClick={() => setDays(range.days)}
                  aria-pressed={days === range.days}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs transition",
                    days === range.days
                      ? "bg-sky-500/10 font-medium text-sky-700 dark:bg-white/10 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw className={cn("mr-1.5 size-3.5", loading && "animate-spin")} aria-hidden />
              刷新
            </Button>
          </div>
        }
      />

      {error ? <AdminError message={error} /> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="浏览量 PV"
              value={data.totals.pv.toLocaleString("zh-CN")}
              icon={Eye}
              delta={pvDelta}
              hint="较上期"
            />
            <StatCard
              label="访客数 UV"
              value={data.totals.uv.toLocaleString("zh-CN")}
              icon={Users}
              delta={uvDelta}
              hint="按 IP 去重"
            />
            <StatCard
              label="人均浏览"
              value={perVisitor}
              icon={MousePointerClick}
              hint="PV / UV"
            />
            <StatCard
              label="覆盖天数"
              value={`${data.range.days} 天`}
              icon={TrendingUp}
              hint={`明细保留 ${data.range.retentionDays} 天`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>每日趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={data.daily} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: string) => value.slice(5)}
                      minTickGap={16}
                      stroke="currentColor"
                      opacity={0.6}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="currentColor" opacity={0.6} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 12 }}
                      labelFormatter={(value) => String(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {/* 后台图表关掉入场动画：切换区间时重新画线会让人误以为数据在增长。 */}
                    <Line
                      type="monotone"
                      dataKey="pv"
                      name="PV"
                      stroke={CHART_PV}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="uv"
                      name="UV"
                      stroke={CHART_UV}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* items-start：右侧热门页面表格更高，不拉伸左侧图表卡片留出大片空白。 */}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>24 小时分布</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart
                      data={data.hours.map((hour) => ({ ...hour, label: `${hour.label}时` }))}
                      margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        interval={2}
                        stroke="currentColor"
                        opacity={0.6}
                      />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="currentColor" opacity={0.6} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                      <Bar
                        dataKey="pv"
                        name="PV"
                        fill={CHART_PV}
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  热门页面
                  <Badge variant="muted">{data.topPages.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {data.topPages.length === 0 ? (
                  <AdminEmptyState title="还没有访问数据" description="等站点有访客后这里会自动出现。" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>路径</TableHead>
                        <TableHead className="w-16 text-right">PV</TableHead>
                        <TableHead className="w-16 text-right">UV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topPages.map((page) => (
                        <TableRow key={page.key}>
                          <TableCell
                            className="max-w-[24rem] truncate font-mono text-[11px]"
                            title={page.key}
                          >
                            {page.key}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{page.pv}</TableCell>
                          <TableCell className="text-right tabular-nums text-slate-500">
                            {page.uv}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <BreakdownCard title="设备" rows={data.devices} total={data.totals.pv} />
            <BreakdownCard title="浏览器" rows={data.browsers} total={data.totals.pv} />
            <BreakdownCard title="地区" rows={data.countries} total={data.totals.pv} />
          </div>
        </>
      ) : null}

      {!data && loading ? (
        <p className="text-xs text-slate-500">正在读取统计数据…</p>
      ) : null}
    </div>
  );
}
