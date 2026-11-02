import type { Metadata } from "next";
import LoginForm from "@/components/admin/LoginForm";
import { env } from "@/server/env";
import { loadSiteSettings } from "@/server/modules/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await loadSiteSettings();

  return {
    title: `登录 · ${profile.siteTitle}`,
    robots: { index: false, follow: false },
  };
}

const authConfigured = Boolean(
  env.AUTH_SECRET && env.AUTH_SECRET.length >= 32,
);

export default async function AdminLoginPage() {
  const { profile } = await loadSiteSettings();
  const showDevWarning = env.NODE_ENV !== "production" && !authConfigured;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-gradient-to-br from-sky-50 via-white to-indigo-50 px-4 py-12 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.16),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(129,140,248,0.12),transparent_35%)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-sky-500 text-lg font-black text-white shadow-lg shadow-sky-500/30 dark:bg-sky-400 dark:text-slate-950">
            K
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            管理后台
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-500">
            使用管理员账号登录 {profile.siteTitle}
          </p>
        </div>

        {showDevWarning ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-5 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
          >
            未配置 <code className="font-mono">AUTH_SECRET</code>。请在
            <code className="mx-1 font-mono">.env.local</code>
            中设置至少 32 位随机字符后重启 dev server，否则登录会返回 500。
          </p>
        ) : null}

        <div className="rounded-2xl border border-white/70 bg-white/60 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035] dark:shadow-2xl dark:shadow-black/30">
          <LoginForm />
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-500 dark:text-slate-600">
          管理接口仅接受管理员会话；访客 GitHub 登录不能访问后台。
        </p>
      </div>
    </main>
  );
}
