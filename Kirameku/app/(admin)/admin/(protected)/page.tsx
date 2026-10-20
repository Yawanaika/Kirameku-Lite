import type { Metadata } from "next";
import { MessageSquare, PenLine, Users, Eye } from "lucide-react";
import { dashboardService } from "@/server/modules/dashboard/service";

export const metadata: Metadata = {
  title: "仪表盘 · Kirameku Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminDashboardPage() {
  const { counts, recentPosts } = await dashboardService.stats();

  const cards = [
    {
      label: "已发布文章",
      value: counts.posts,
      icon: PenLine,
      tone: "text-sky-300",
    },
    {
      label: "待审核评论",
      value: counts.pendingComments,
      icon: MessageSquare,
      tone: "text-amber-300",
    },
    {
      label: "待审核留言",
      value: counts.pendingMessages,
      icon: MessageSquare,
      tone: "text-violet-300",
    },
    {
      label: "访客记录",
      value: counts.visitors,
      icon: Users,
      tone: "text-emerald-300",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-600 uppercase">
          Overview
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          仪表盘
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          站点内容与待处理事项概览。
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">{card.label}</p>
                <Icon className={`size-4 ${card.tone}`} aria-hidden />
              </div>
              <p className="mt-4 text-3xl font-semibold tabular-nums text-white">
                {card.value}
              </p>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">最近文章</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              按更新时间排序，最多显示 5 条。
            </p>
          </div>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-500">
            P3 开放编辑
          </span>
        </div>

        {recentPosts.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm text-slate-400">还没有文章</p>
            <p className="mt-1 text-xs text-slate-600">
              文章编辑器将在 P3 管理后台阶段接入。
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {recentPosts.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                  {item.title}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                  {item.status ?? "draft"}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-600 tabular-nums">
                  <Eye className="size-3" aria-hidden />
                  {item.views ?? 0}
                </span>
                <time className="text-xs text-slate-600">
                  {item.publishedAt
                    ? dateFormatter.format(item.publishedAt)
                    : "未发布"}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
