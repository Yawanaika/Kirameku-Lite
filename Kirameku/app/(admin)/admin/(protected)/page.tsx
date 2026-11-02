import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, PenLine, Users, Eye, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
      tone: "text-sky-500 dark:text-sky-300",
      ring: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300",
    },
    {
      label: "待审核评论",
      value: counts.pendingComments,
      icon: MessageSquare,
      tone: "text-amber-500 dark:text-amber-300",
      ring: "bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300",
    },
    {
      label: "待审核留言",
      value: counts.pendingMessages,
      icon: MessageSquare,
      tone: "text-violet-500 dark:text-violet-300",
      ring: "bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300",
    },
    {
      label: "访客记录",
      value: counts.visitors,
      icon: Users,
      tone: "text-emerald-500 dark:text-emerald-300",
      ring: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase dark:text-slate-600">
            Overview
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            仪表盘
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            站点内容与待处理事项概览。
          </p>
        </div>
        <Link href="/admin/posts/new" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          新建文章
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm shadow-slate-900/5 backdrop-blur-md transition hover:shadow-md dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  {card.label}
                </p>
                <span
                  className={`grid size-7 place-items-center rounded-lg ${card.ring}`}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
              </div>
              <p className="mt-4 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
                {card.value}
              </p>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/60 shadow-sm shadow-slate-900/5 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              最近文章
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-500">
              按更新时间排序，最多显示 5 条。
            </p>
          </div>
          <Link
            href="/admin/posts"
            className="text-[11px] text-slate-500 transition hover:text-sky-600 dark:hover:text-sky-300"
          >
            查看全部
          </Link>
        </div>

        {recentPosts.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              还没有文章
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-600">
              从后台创建第一篇文章，发布后会出现在前台。
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/70 dark:divide-white/5">
            {recentPosts.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
              >
                <Link
                  href={`/admin/posts/${item.id}`}
                  className="min-w-0 flex-1 truncate text-sm text-slate-700 hover:text-sky-600 dark:text-slate-200 dark:hover:text-sky-300"
                >
                  {item.title}
                </Link>
                <span className="rounded-full bg-slate-900/[0.04] px-2 py-0.5 text-[10px] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  {item.status ?? "draft"}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums dark:text-slate-600">
                  <Eye className="size-3" aria-hidden />
                  {item.views ?? 0}
                </span>
                <time className="text-xs text-slate-500 dark:text-slate-600">
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
