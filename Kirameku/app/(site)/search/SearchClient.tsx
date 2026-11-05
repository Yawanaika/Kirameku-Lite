"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, FileText, ArrowLeft } from "lucide-react";
import type { SearchResult } from "@/lib/api/search";
import { formatDate } from "@/lib/format";

export default function SearchClient({
  initialQuery,
  initialResult,
}: {
  initialQuery: string;
  initialResult: SearchResult;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  // 结果直接来自服务端渲染；同一个关键词内不再改动，所以只用 props 初始化。
  const result: SearchResult = initialResult;
  const [pending, startTransition] = useTransition();

  // 每次关键词变化由 page.tsx 用 key 重新挂载本组件，
  // 因此 value / result 直接用 props 初始化即可，不需要在 effect 里同步。

  /**
   * 只改地址栏，结果由服务端重新渲染。
   * 这里不再额外 fetch 一次：两路数据会互相覆盖，反而闪一下。
   */
  function submit(next: string) {
    const q = next.trim();
    if (!q) return;
    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    });
  }

  const busy = pending;
  const showEmptyState = result.query !== "" && result.hits.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 md:py-12">
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-indigo-500 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Link>
      </div>

      <h1 className="mb-1 text-xl font-bold text-slate-800 dark:text-white md:text-2xl">
        搜索
      </h1>
      <p className="mb-6 text-sm text-slate-400">
        {result.query
          ? `找到 ${result.total} 篇与「${result.query}」相关的文章`
          : "输入关键词，搜索站内已发布的文章"}
      </p>

      <form
        className="relative mb-8"
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          // 从首页搜索框跳过来时直接聚焦，省一次点击。
          autoFocus={!initialQuery}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="搜索标题或正文…"
          aria-label="搜索关键词"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-2xl border border-slate-200/80 bg-white/70 py-3 pl-11 pr-24 text-sm text-slate-800 shadow-sm backdrop-blur transition-all placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          搜索
        </button>
      </form>

      {/* 结果 */}
      {result.hits.length > 0 && (
        <ul className="space-y-3">
          {result.hits.map((hit) => (
            <li key={hit.id}>
              <Link
                href={`/posts/${hit.slug}`}
                className="group block rounded-2xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-indigo-300/60 hover:shadow-lg dark:border-white/10 dark:bg-slate-800/50 dark:hover:border-indigo-400/40"
              >
                <div className="mb-1.5 flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                  <h2 className="text-base font-semibold text-slate-800 transition-colors group-hover:text-indigo-500 dark:text-slate-100">
                    {hit.title}
                  </h2>
                </div>
                {hit.snippet && (
                  <p className="mb-2 line-clamp-2 pl-6 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {hit.snippet}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 pl-6 text-xs text-slate-400">
                  {hit.category && (
                    <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-indigo-500">
                      {hit.category}
                    </span>
                  )}
                  {hit.published_at && (
                    <span>{formatDate(hit.published_at)}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showEmptyState && (
        <div className="rounded-2xl border border-dashed border-slate-200/80 py-14 text-center dark:border-white/10">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            没有找到相关文章，换个关键词试试。
          </p>
          {result.fuzzy && (
            <p className="mt-2 text-xs text-slate-400">
              试试更长的关键词（三个字以上可以走全文索引，结果更准）。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
