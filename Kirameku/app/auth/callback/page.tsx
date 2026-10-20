"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("github_token", token);
      const redirectTo = sessionStorage.getItem("github_redirect") || "/messages";
      sessionStorage.removeItem("github_redirect");
      router.replace(redirectTo);
    } else {
      router.replace("/messages");
    }
  }, [searchParams, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-sky-500" />
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-sky-500" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
