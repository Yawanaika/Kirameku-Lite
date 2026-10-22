import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/server/site";

// Same reasoning as sitemap.ts: the host/sitemap fields are configuration, so
// they must be read per request instead of baked into the build output.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

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
