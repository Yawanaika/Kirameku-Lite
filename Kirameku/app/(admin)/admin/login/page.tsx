import type { Metadata } from "next";
import LoginForm from "@/components/admin/LoginForm";
import { env } from "@/server/env";
import { siteConfig } from "@/siteConfig";

export const metadata: Metadata = {
  title: `登录 · ${siteConfig.title}`,
  robots: { index: false, follow: false },
};

const authConfigured = Boolean(
  env.AUTH_SECRET && env.AUTH_SECRET.length >= 32,
);

export default function AdminLoginPage() {
  const showDevWarning = env.NODE_ENV !== "production" && !authConfigured;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.16),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(129,140,248,0.12),transparent_35%)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-sky-400 text-lg font-black text-slate-950 shadow-lg shadow-sky-400/20">
            K
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-white">
            管理后台
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            使用管理员账号登录 {siteConfig.title}
          </p>
        </div>

        {showDevWarning ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3.5 py-2.5 text-xs leading-5 text-amber-200"
          >
            未配置 <code className="font-mono">AUTH_SECRET</code>。请在
            <code className="mx-1 font-mono">.env.local</code>
            中设置至少 32 位随机字符后重启 dev server，否则登录会返回 500。
          </p>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <LoginForm />
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-600">
          管理接口仅接受管理员会话；访客 GitHub 登录不能访问后台。
        </p>
      </div>
    </main>
  );
}
