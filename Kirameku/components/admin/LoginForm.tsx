"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  nextPath?: string;
}

export default function LoginForm({ nextPath = "/admin" }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        setError(payload.error?.message ?? "登录失败，请稍后重试");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-slate-600 dark:text-slate-400">
          用户名
        </span>
        <input
          className="w-full rounded-xl border border-slate-300/80 bg-white/70 px-3.5 py-2.5 text-sm text-slate-800 outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-600"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-slate-600 dark:text-slate-400">
          密码
        </span>
        <input
          className="w-full rounded-xl border border-slate-300/80 bg-white/70 px-3.5 py-2.5 text-sm text-slate-800 outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:placeholder:text-slate-600"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-sky-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-sky-500/20 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
      >
        {pending ? "登录中…" : "进入后台"}
      </button>
    </form>
  );
}
