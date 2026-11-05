"use client";

import { motion } from "framer-motion";
import { TrendingUp, Code2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

/**
 * recharts 静态引入会给 /garden 首屏多带约 600KB，而这两块图在服务端渲染时
 * 也只是一张空图（数据来自 useEffect 里的 fetch）。
 * 所以把它们单独拆成一个模块，由 page.tsx 用 next/dynamic 在客户端加载。
 */

const fadeIn = {
  hidden: { opacity: 0, scale: 0.85 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 20 },
  },
};

export interface TrendPoint {
  date: string;
  文章: number;
  说说: number;
}

export interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

interface GardenChartsProps {
  trendData: TrendPoint[];
  categoryData: CategorySlice[];
  activePie?: number;
  onActivePieChange: (index: number | undefined) => void;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-lg px-3 py-2 shadow-lg border border-slate-200/50 dark:border-white/10 text-xs">
      <p className="font-medium text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.dataKey}: {p.value} 篇
        </p>
      ))}
    </div>
  );
}

export default function GardenCharts({
  trendData,
  categoryData,
  activePie,
  onActivePieChange,
}: GardenChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* line chart */}
      <motion.div variants={fadeIn} className="lg:col-span-2 bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 md:p-5 border border-slate-200/50 dark:border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">发布趋势</h2>
        </div>
        <div className="h-52 md:h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="文章" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1" }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="说说" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: "#f59e0b" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* pie chart */}
      <motion.div variants={fadeIn} className="bg-white/70 dark:bg-slate-800/50 backdrop-blur-md rounded-xl p-4 md:p-5 border border-slate-200/50 dark:border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <Code2 className="w-4 h-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">分类占比</h2>
        </div>
        <div className="h-52 md:h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius="45%"
                outerRadius="70%"
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                {...{ activeIndex: activePie, activeOuterRadius: "75%" }}
                onMouseEnter={(_, i) => onActivePieChange(i)}
                onMouseLeave={() => onActivePieChange(undefined)}
              >
                {categoryData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const units: Record<string, string> = { 文章: "篇", 说说: "条", 留言: "条", 照片: "张" };
                  return [`${value} ${units[name as string] ?? ""}`, name];
                }}
                contentStyle={{
                  background: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => <span className="text-xs text-slate-500 dark:text-slate-400">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
