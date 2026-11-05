import { describe, it, expect } from "vitest";
import { renderMarkdownWithToc } from "@/lib/markdown";

describe("renderMarkdownWithToc", () => {
  it("adds unique ids and builds a toc", async () => {
    const md = "## 安装步骤\n\n正文\n\n### 依赖说明\n\n## 安装步骤\n\n## Hello World!\n";
    const { html, toc } = await renderMarkdownWithToc(md);
    console.log(JSON.stringify(toc));
    console.log(html);
    expect(toc).toHaveLength(4);
    expect(toc[0]).toEqual({ level: 2, id: "安装步骤", text: "安装步骤" });
    expect(toc[3].id).toBe("hello-world");
    expect(html).toContain('id="安装步骤-2"');
  });
});
