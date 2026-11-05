import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/server/site";

// Same reasoning as sitemap.ts: the host/sitemap fields are configuration, so
// they must be read per request instead of baked into the build output.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /garden 是密码门禁区：未解锁时服务端渲染的是空壳，
        // 爬虫抓到的只有空白页，直接挡在 robots 外面；/search 是查询页。
        disallow: ["/admin", "/api", "/auth", "/garden", "/search"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
