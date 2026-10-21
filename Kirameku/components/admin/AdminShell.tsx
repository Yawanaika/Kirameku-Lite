import Link from "next/link";
import AdminNav from "./AdminNav";
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

        <AdminNav />
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
