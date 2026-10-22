"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getGithubUser } from "@/lib/api/github-auth";

function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/messages";
  }
  return value;
}

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    // 旧的 Bearer token 已废弃，登录态只保存在 httpOnly Cookie 中。
    localStorage.removeItem("github_token");

    const redirectTo = safeRedirect(sessionStorage.getItem("github_redirect"));
    sessionStorage.removeItem("github_redirect");

    getGithubUser()
      .then((user) => {
        if (active) localStorage.setItem("github_user", JSON.stringify(user));
      })
      .catch(() => {
        if (active) localStorage.removeItem("github_user");
      })
      .finally(() => {
        if (active) router.replace(redirectTo);
      });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-sky-500" />
    </div>
  );
}
