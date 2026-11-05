import type { Metadata } from "next";
import { getSearchService } from "@/server/modules/search";
import { loadSiteSettings } from "@/server/modules/site-settings";
import type { SearchResult } from "@/lib/api/search";
import SearchClient from "./SearchClient";

/** 搜索结果跟着关键词走，不缓存；同一进程内每次查询都要看最新文章。 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { profile } = await loadSiteSettings();
  return {
    title: `搜索 · ${profile.siteTitle}`,
    description: "搜索站内文章",
    // 搜索结果页没有稳定的内容，不应当进索引。
    robots: { index: false, follow: true },
  };
}

const EMPTY: SearchResult = { query: "", total: 0, hits: [], fuzzy: false };

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const raw = Array.isArray(q) ? q[0] : q;
  const query = (raw ?? "").trim().slice(0, 100);

  let initial = EMPTY;
  if (query) {
    try {
      initial = await getSearchService().search({ q: query, limit: 20 });
    } catch (error) {
      // 搜索挂了不该整页 500：交给客户端展示空结果并可以重试。
      console.error("Failed to search posts", error);
    }
  }

  // key 让关键词变化时组件重新挂载，输入框与结果都跟着 props 初始化，
  // 不必在 effect 里同步派生状态。
  return (
    <SearchClient key={query} initialQuery={query} initialResult={initial} />
  );
}
