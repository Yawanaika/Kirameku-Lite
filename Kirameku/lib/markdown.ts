import "server-only";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

/**
 * Render trusted-by-role but untrusted-by-content Markdown to HTML.
 *
 * The sanitizer runs before highlighting, so author-supplied HTML/attributes
 * are stripped while the `hljs-*` classes generated afterwards are preserved.
 * This keeps `dangerouslySetInnerHTML` limited to a known-safe allowlist.
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown) return "";

  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeHighlight, { detect: false })
    .use(rehypeStringify)
    .process(markdown);

  return String(file);
}
