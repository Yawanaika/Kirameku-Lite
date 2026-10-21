import type { MetadataRoute } from "next";
import { siteConfig } from "@/siteConfig";

export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/auth"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
