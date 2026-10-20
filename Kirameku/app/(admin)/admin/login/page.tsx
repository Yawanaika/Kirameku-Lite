import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/admin/LoginForm";
import { getAdminSession } from "@/server/auth/guard";
import { siteConfig } from "@/siteConfig";

export const metadata: Metadata = {
  title: `登录 · ${siteConfig.title}`,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function safeNext(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/admin";
  if (!value.startsWith("/admin") || value.startsWith("//")) return "/admin";
  return value;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const admin = await getAdminSession();
  if (admin) redirect("/admin");

  const params = await searchParams;
  const nextPath = safeNext(params.next);

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

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <LoginForm nextPath={nextPath} />
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-600">
          管理接口仅接受管理员会话；访客 GitHub 登录不能访问后台。
        </p>
      </div>
    </main>
  );
}
