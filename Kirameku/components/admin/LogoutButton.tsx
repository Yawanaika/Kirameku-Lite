"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2 text-xs font-medium text-slate-600 backdrop-blur transition hover:border-rose-400/40 hover:text-rose-600 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:border-rose-400/30 dark:hover:text-rose-200"
    >
      <LogOut className="size-3.5" aria-hidden />
      退出
    </button>
  );
}
