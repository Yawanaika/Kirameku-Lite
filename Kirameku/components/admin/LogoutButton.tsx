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
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-rose-400/30 hover:text-rose-200"
    >
      <LogOut className="size-3.5" aria-hidden />
      退出
    </button>
  );
}
