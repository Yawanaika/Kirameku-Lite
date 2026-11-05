import { z } from "zod";

/**
 * 站内搜索入参。
 *
 * limit 上限 30：搜索页一次只要一屏多一点，更大的分页没有意义，
 * 也能顺手限制单次查询的扫描量。
 */
export const searchQuery = z.object({
  q: z.string().trim().min(1, "请输入搜索关键词").max(100, "关键词太长了"),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export type SearchQuery = z.infer<typeof searchQuery>;

export interface SearchHit {
  id: number;
  title: string;
  slug: string;
  /** 文章摘要（列表里展示），没有则空串。 */
  description: string;
  /** 命中的上下文片段，已去掉 Markdown 记号。 */
  snippet: string;
  category: string;
  published_at: string | null;
}

export interface SearchResult {
  /** 规范化后的关键词（空白已折叠）。 */
  query: string;
  total: number;
  hits: SearchHit[];
  /**
   * 关键词任一 token 少于 3 个字符时为 true：trigram 索引只能处理 >= 3 字符的
   * MATCH，这类查询退回 LIKE 全表扫描。结果正确，只是不排序。
   */
  fuzzy: boolean;
}
