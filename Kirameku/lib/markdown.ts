import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

/** 目录条目。level 只取 2/3，h1 留给文章标题。 */
export interface TocEntry {
  level: 2 | 3;
  id: string;
  text: string;
}

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** 递归取出标题里的纯文本（标题里可能嵌着 code/em/strong）。 */
function collectText(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  if (!node.children) return "";
  return node.children.map(collectText).join("");
}

/**
 * 给标题生成锚点 id 并顺手收集目录。
 *
 * 这里不引入 rehype-slug：标题多为中文，通用 slug 会把它们整段吃掉，
 * 而我们需要的是「可读 + 唯一 + URL 安全」三者兼顾，自己写不到 30 行。
 * 注意插件排在 rehypeSanitize 之后，所以 id 不会被清洗掉。
 */
function rehypeHeadingAnchors(toc: TocEntry[]) {
  return (tree: HastNode) => {
    const used = new Map<string, number>();

    const walk = (node: HastNode) => {
      if (node.type === "element" && /^h[1-4]$/.test(node.tagName ?? "")) {
        const level = Number(node.tagName!.slice(1));
        const text = collectText(node).trim();
        if (text) {
          const base = text
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]/gu, "")
            .trim()
            .replace(/\s+/g, "-");
          const slug = base || "section";
          const seen = used.get(slug) ?? 0;
          used.set(slug, seen + 1);
          const id = seen === 0 ? slug : `${slug}-${seen + 1}`;
          node.properties = { ...(node.properties ?? {}), id };
          if (level === 2 || level === 3) {
            toc.push({ level, id, text });
          }
        }
      }
      node.children?.forEach(walk);
    };

    walk(tree);
  };
}

function renderer(toc?: TocEntry[]) {
  const pipeline = unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize);
  if (toc) pipeline.use(rehypeHeadingAnchors, toc);
  return pipeline
    .use(rehypeHighlight, { detect: false })
    .use(rehypeStringify);
}

/**
 * Render trusted-by-role but untrusted-by-content Markdown to HTML.
 *
 * The sanitizer runs before highlighting, so author-supplied HTML/attributes
 * are stripped while the `hljs-*` classes generated afterwards are preserved.
 * This keeps `dangerouslySetInnerHTML` limited to a known-safe allowlist.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown) return "";
  const file = await renderer().process(markdown);
  return String(file);
}

/**
 * 文章详情用：渲染正文，并返回标题锚点目录。
 * 标题 id 与目录共用同一次遍历，不会出现「目录跳不过去」的情况。
 */
export async function renderMarkdownWithToc(
  markdown: string,
): Promise<{ html: string; toc: TocEntry[] }> {
  if (!markdown) return { html: "", toc: [] };
  const toc: TocEntry[] = [];
  const file = await renderer(toc).process(markdown);
  return { html: String(file), toc };
}
