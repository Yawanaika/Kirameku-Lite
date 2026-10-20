import Link from "next/link";
import {
  Bookmark,
  FileText,
  FolderKanban,
  Images,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import LogoutButton from "./LogoutButton";

interface AdminShellProps {
  admin: {
    id: number;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
  children: React.ReactNode;
}

const upcoming = [
  { label: "文章", icon: FileText },
  { label: "评论 / 留言", icon: MessageSquare },
  { label: "相册", icon: Images },
  { label: "项目", icon: FolderKanban },
  { label: "友链", icon: Link2 },
  { label: "收藏夹", icon: Bookmark },
  { label: "访客", icon: Users },
  { label: "站点配置", icon: Settings },
];

export default function AdminShell({ admin, children }: AdminShellProps) {
  const displayName = admin.nickname || admin.username;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-white/10 bg-slate-900/70 px-4 py-4 lg:min-h-screen lg:border-r lg:border-b-0 lg:px-5 lg:py-6">
        <Link href="/admin" className="flex items-center gap-3 px-1">
          <span className="grid size-9 place-items-center rounded-xl bg-sky-400 text-sm font-black text-slate-950">
            K
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-wide">
              Kirameku
            </span>
            <span className="block text-[11px] text-slate-500">Admin Console</span>
          </span>
        </Link>

        <nav className="mt-8 space-y-1" aria-label="后台导航">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium text-white"
          >
            <LayoutDashboard className="size-4 text-sky-300" aria-hidden />
            仪表盘
          </Link>

          <p className="px-3 pt-5 pb-2 text-[10px] font-semibold tracking-[0.18em] text-slate-600 uppercase">
            内容管理
          </p>
          {upcoming.map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.label}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500"
                title="P3 管理后台阶段开放"
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
                <span className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-600">
                  P3
                </span>
              </span>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 lg:px-8">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-600 uppercase">
              Workspace
            </p>
            <p className="mt-0.5 text-sm text-slate-300">
              你好，{displayName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:text-white"
            >
              查看站点
            </Link>
            <LogoutButton />
          </div>
        </header>

        <main className="p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
