import { NextResponse } from "next/server";
import { siteConfig } from "@/siteConfig";
import { marked } from "marked";
import { getPostsService } from "@/server/modules/posts";
import type {
  PostDetail,
  PostItem,
} from "@/server/modules/posts/contracts";

export const revalidate = 3600;

const FEED_AUTHOR = `guh982719@gmail.com (${siteConfig.authorName})`;

export async function GET() {
  try {
    const service = getPostsService();
    const posts = await service.list({
      status: "published",
      page: 1,
      size: 10,
    });

    // The list response intentionally omits content; fetch each body locally.
    const detailResults = await Promise.allSettled(
      posts.map((post) =>
        service.getBySlug(post.slug, { publishedOnly: true }),
      ),
    );

    const items = (
      await Promise.all(
        posts.map(async (post, i) => {
          const detail =
            detailResults[i].status === "fulfilled"
              ? detailResults[i].value
              : null;

          return generateItem(post, detail);
        })
      )
    ).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(siteConfig.title)}</title>
    <link>${siteConfig.url}</link>
    <description>${escapeXml(siteConfig.bio)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteConfig.url}/feed" rel="self" type="application/rss+xml"/>
    <generator>Next.js</generator>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("RSS generation failed:", error);
    return new NextResponse("Failed to generate RSS feed", { status: 500 });
  }
}

async function generateItem(
  post: PostItem,
  detail: PostDetail | null
): Promise<string> {
  const postUrl = `${siteConfig.url}/posts/${post.slug}`;
  const pubDate = post.published_at
    ? new Date(post.published_at).toUTCString()
    : new Date(post.created_at).toUTCString();

  const categories = post.tags
    .map((tag) => `      <category>${escapeXml(tag)}</category>`)
    .join("\n");

  // 全文 HTML（markdown → HTML）
  let contentHtml = "";
  if (detail?.content) {
    try {
      contentHtml = await marked.parse(detail.content);
    } catch {
      contentHtml = escapeXml(detail.content);
    }
  }

  return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <description><![CDATA[${post.description || ""}]]></description>
      <content:encoded><![CDATA[${contentHtml}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(FEED_AUTHOR)}</author>${categories ? `\n${categories}` : ""}
    </item>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
