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
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-slate-400">
          用户名
        </span>
        <input
          className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/10"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-slate-400">
          密码
        </span>
        <input
          className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/10"
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
          className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-sky-400 px-3.5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "登录中…" : "进入后台"}
      </button>
    </form>
  );
}
