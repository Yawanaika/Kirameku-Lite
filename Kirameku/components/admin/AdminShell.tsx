import Link from "next/link";
import AdminMobileNav from "./AdminMobileNav";
import AdminNav from "./AdminNav";
import { ConfirmProvider } from "./ConfirmProvider";
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

/**
 * 后台外壳。
 *
 * 明暗两套外观都走同一棵 DOM：浅色是默认（毛玻璃 + 柔和背景光斑，与前台一致），
 * 暗色只在 `dark` 下接管。这样后台不再强制暗色调，跟随访问者在前台选的主题。
 */
export default function AdminShell({ admin, children }: AdminShellProps) {
  const displayName = admin.nickname || admin.username;

  return (
    <ConfirmProvider>
      <div className="relative min-h-screen bg-gradient-to-br from-sky-50 via-white to-indigo-50 text-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        {/* 背景光斑：只做氛围，不参与交互 */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(56,189,248,0.12),transparent_38%),radial-gradient(circle_at_85%_85%,rgba(129,140,248,0.10),transparent_40%)] dark:bg-[radial-gradient(circle_at_15%_10%,rgba(56,189,248,0.10),transparent_38%),radial-gradient(circle_at_85%_85%,rgba(129,140,248,0.08),transparent_40%)]"
        />

        <aside className="relative hidden border-r border-white/60 bg-white/60 px-5 py-6 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
          <Link href="/admin" className="flex items-center gap-3 px-1">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-500 text-sm font-black text-white shadow-sm shadow-sky-500/30 dark:bg-sky-400 dark:text-slate-950">
              K
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                Kirameku
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-500">
                Admin Console
              </span>
            </span>
          </Link>

          <AdminNav />
        </aside>

        <div className="relative min-w-0">
          <header className="flex items-center justify-between border-b border-white/60 bg-white/40 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-transparent lg:px-8">
            <div className="flex items-center gap-3">
              <AdminMobileNav />
              <div>
                <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase dark:text-slate-600">
                  Workspace
                </p>
                <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
                  你好，{displayName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="rounded-xl px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                查看站点
              </Link>
              <LogoutButton />
            </div>
          </header>

          <main className="p-5 lg:p-8">{children}</main>
        </div>
      </div>
    </ConfirmProvider>
  );
}
