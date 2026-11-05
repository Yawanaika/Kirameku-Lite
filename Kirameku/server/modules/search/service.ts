import { sql } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import type { SearchHit, SearchQuery, SearchResult } from "./contracts";

/** trigram 分词器无法索引短于 3 字符的查询，这类查询走 LIKE 兜底。 */
const MIN_MATCH_CHARS = 3;
/** 片段命中点前后各截这么多字符。 */
const SNIPPET_RADIUS = 80;

interface RawRow {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  content: string | null;
  publishedAt: number | null;
  category: string | null;
}

interface CountRow {
  total: number;
}

/** 把关键词按空白切成 token，顺带去掉空串。 */
function tokenize(query: string): string[] {
  return query.split(/\s+/).filter(Boolean);
}

function charLength(value: string): number {
  return [...value].length;
}

/**
 * 转成 FTS5 的 MATCH 表达式：每个 token 加双引号当短语，token 之间用 AND。
 * 双引号内的 `"` 需要转义成 `""`，否则可以把 FTS 语法注入到查询里。
 */
function toMatchExpression(tokens: string[]): string {
  return tokens
    .map((token) => `"${token.replace(/"/g, '""')}"`)
    .join(" AND ");
}

/** Markdown 记号的粗略剥离：只为让片段读起来像人话，不追求完整解析。 */
function stripMarkup(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/[>*_`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 在正文里找到第一个命中的 token，截一段上下文。 */
function buildSnippet(raw: string, tokens: string[]): string {
  const text = stripMarkup(raw);
  if (!text) return "";
  const lower = text.toLowerCase();

  let at = -1;
  for (const token of tokens) {
    const index = lower.indexOf(token.toLowerCase());
    if (index >= 0 && (at < 0 || index < at)) at = index;
  }

  if (at < 0) {
    // 只在标题或摘要里命中时正文里找不到位置，直接给开头一段。
    const head = text.slice(0, SNIPPET_RADIUS * 2);
    return head.length < text.length ? `${head}…` : head;
  }

  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function toHit(row: RawRow, tokens: string[]): SearchHit {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? "",
    snippet: buildSnippet(row.content || row.description || "", tokens),
    category: row.category ?? "",
    published_at: row.publishedAt
      ? new Date(row.publishedAt).toISOString()
      : null,
  };
}

/** LIKE 模式串：`%`/`_`/反斜杠按字面量处理（ESCAPE 默认字符就是反斜杠）。 */
function toLikePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

export function createSearchService(db: AppDatabase) {
  /**
   * 只搜已发布的文章：搜索是公开能力，草稿泄露比搜不到严重得多。
   * 命中排序用 bm25（标题权重 5、摘要 2、正文 1），同分再按发布时间倒序。
   */
  async function searchWithIndex(
    expression: string,
    limit: number,
  ): Promise<{ rows: RawRow[]; total: number }> {
    const filter = sql`"post_search" MATCH ${expression}`;

    const rows = await db.all<RawRow>(sql`
      SELECT p."id" AS id,
             p."title" AS title,
             p."slug" AS slug,
             p."description" AS description,
             p."content" AS content,
             p."published_at" AS publishedAt,
             c."name" AS category
      FROM "post_search"
      JOIN "post" p ON p."id" = "post_search"."rowid"
      LEFT JOIN "category" c ON c."id" = p."category_id"
      WHERE ${filter} AND p."status" = 'published'
      ORDER BY bm25("post_search", 5.0, 2.0, 1.0), p."published_at" DESC
      LIMIT ${limit}
    `);

    const [count] = await db.all<CountRow>(sql`
      SELECT count(*) AS total
      FROM "post_search"
      JOIN "post" p ON p."id" = "post_search"."rowid"
      WHERE ${filter} AND p."status" = 'published'
    `);

    return { rows, total: count?.total ?? 0 };
  }

  /** 关键词短于 3 字符时的兜底：直接 LIKE 扫描，个人博客的数据量下够用。 */
  async function searchWithLike(
    query: string,
    limit: number,
  ): Promise<{ rows: RawRow[]; total: number }> {
    const pattern = toLikePattern(query);

    const rows = await db.all<RawRow>(sql`
      SELECT p."id" AS id,
             p."title" AS title,
             p."slug" AS slug,
             p."description" AS description,
             p."content" AS content,
             p."published_at" AS publishedAt,
             c."name" AS category
      FROM "post" p
      LEFT JOIN "category" c ON c."id" = p."category_id"
      WHERE p."status" = 'published'
        AND (p."title" LIKE ${pattern}
          OR p."description" LIKE ${pattern}
          OR p."content" LIKE ${pattern})
      ORDER BY p."published_at" DESC
      LIMIT ${limit}
    `);

    const [count] = await db.all<CountRow>(sql`
      SELECT count(*) AS total
      FROM "post" p
      WHERE p."status" = 'published'
        AND (p."title" LIKE ${pattern}
          OR p."description" LIKE ${pattern}
          OR p."content" LIKE ${pattern})
    `);

    return { rows, total: count?.total ?? 0 };
  }

  return {
    async search(input: SearchQuery): Promise<SearchResult> {
      const query = input.q.replace(/\s+/g, " ").trim();
      if (!query) return { query: "", total: 0, hits: [], fuzzy: false };

      const tokens = tokenize(query);
      const fuzzy = tokens.some((token) => charLength(token) < MIN_MATCH_CHARS);

      const { rows, total } = fuzzy
        ? await searchWithLike(query, input.limit)
        : await searchWithIndex(toMatchExpression(tokens), input.limit);

      return {
        query,
        total,
        hits: rows.map((row) => toHit(row, tokens)),
        fuzzy,
      };
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
