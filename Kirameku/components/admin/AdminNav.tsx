"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  FileText,
  FolderKanban,
  FolderOpen,
  Images,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryItems = [
  { href: "/admin", label: "仪表盘", icon: LayoutDashboard, exact: true },
  { href: "/admin/posts", label: "文章", icon: FileText },
  { href: "/admin/chatters", label: "说说", icon: MessageSquare },
  { href: "/admin/projects", label: "项目", icon: FolderKanban },
  { href: "/admin/comments", label: "评论", icon: MessageSquare },
  { href: "/admin/messages", label: "留言", icon: MessageSquare },
];

const upcomingItems = [
  { label: "分类 / 标签", icon: FolderOpen },
  { label: "相册", icon: Images },
  { label: "友链", icon: Link2 },
  { label: "收藏夹", icon: Bookmark },
  { label: "站点配置", icon: Settings },
  { label: "访客", icon: Users },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-8 space-y-1" aria-label="后台导航">
      <p className="px-3 pb-2 text-[10px] font-semibold tracking-[0.18em] text-slate-600 uppercase">
        Workspace
      </p>
      {primaryItems.map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              active
                ? "bg-white/10 font-medium text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon
              className={cn(
                "size-4",
                active ? "text-sky-300" : "text-slate-500",
              )}
              aria-hidden
            />
            {item.label}
          </Link>
        );
      })}

      <p className="px-3 pt-5 pb-2 text-[10px] font-semibold tracking-[0.18em] text-slate-600 uppercase">
        待接入
      </p>
      {upcomingItems.map((item) => {
        const Icon = item.icon;
        return (
          <span
            key={item.label}
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600"
            title="后续批次开放"
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
            <span className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-600">
              Soon
            </span>
          </span>
        );
      })}
    </nav>
  );
}
