import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings, links and lists", async () => {
    const html = await renderMarkdown(
      "# Title\n\n- item\n\n[link](https://example.com)",
    );

    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<li>item</li>");
    expect(html).toContain('href="https://example.com"');
  });

  it("strips scripts, event handlers and javascript: urls", async () => {
    const html = await renderMarkdown(
      [
        "safe text",
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)" />',
        "[bad](javascript:alert(1))",
        '<iframe src="https://evil.example"></iframe>',
      ].join("\n\n"),
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("safe text");
  });

  it("highlights fenced code blocks after sanitizing", async () => {
    const html = await renderMarkdown("```ts\nconst answer = 42;\n```");

    expect(html).toContain('class="hljs language-ts"');
    expect(html).toContain("hljs-keyword");
  });

  it("returns an empty string for empty input", async () => {
    await expect(renderMarkdown("")).resolves.toBe("");
  });
});
