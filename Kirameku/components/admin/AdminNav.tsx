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
  ScrollText,
  Settings,
  UserRound,
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
  { href: "/admin/taxonomy", label: "分类 / 标签", icon: FolderOpen },
  { href: "/admin/friend-links", label: "友链", icon: Link2 },
  { href: "/admin/bookmarks", label: "收藏夹", icon: Bookmark },
  { href: "/admin/albums", label: "相册", icon: Images },
  { href: "/admin/site-config", label: "站点配置", icon: Settings },
  { href: "/admin/visitors", label: "访客", icon: Users },
  { href: "/admin/audit", label: "操作审计", icon: ScrollText },
  { href: "/admin/account", label: "账号", icon: UserRound },
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
    </nav>
  );
}
