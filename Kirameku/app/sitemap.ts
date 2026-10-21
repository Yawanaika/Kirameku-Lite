import type { MetadataRoute } from "next";
import { siteConfig } from "@/siteConfig";
import { getPostsService } from "@/server/modules/posts";

export const revalidate = 3600;

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/posts", changeFrequency: "weekly", priority: 0.9 },
  { path: "/moments", changeFrequency: "daily", priority: 0.8 },
  { path: "/messages", changeFrequency: "weekly", priority: 0.6 },
  { path: "/bookmark", changeFrequency: "monthly", priority: 0.6 },
  { path: "/projects", changeFrequency: "monthly", priority: 0.7 },
  { path: "/friends", changeFrequency: "monthly", priority: 0.6 },
  { path: "/photowall", changeFrequency: "monthly", priority: 0.7 },
  { path: "/timeline", changeFrequency: "monthly", priority: 0.7 },
  { path: "/music", changeFrequency: "monthly", priority: 0.5 },
  { path: "/about", changeFrequency: "yearly", priority: 0.5 },
  { path: "/garden", changeFrequency: "monthly", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/+$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let postEntries: MetadataRoute.Sitemap = [];
  try {
    const posts = await getPostsService().listAllPublished();
    postEntries = posts.map((post) => ({
      url: `${base}/posts/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: "monthly",
      priority: 0.8,
    }));
  } catch (error) {
    console.error("Sitemap post query failed:", error);
  }

  return [...staticEntries, ...postEntries];
}
