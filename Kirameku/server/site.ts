import "server-only";
import { env } from "@/server/env";
import { siteConfig } from "@/siteConfig";

export type ShareCard = "summary" | "summary_large_image";

export interface ShareConfig {
  title: string;
  description: string;
  /** Absolute URL, or null when this page has no share image. */
  image: string | null;
  card: ShareCard;
}

/**
 * Canonical public URL without a trailing slash.
 *
 * Resolution order is SITE_URL -> FRONTEND_ORIGIN -> siteConfig.url: a normal
 * deployment sets FRONTEND_ORIGIN for same-origin checks and gets the right URL
 * for free, while a proxy that rewrites the host can set SITE_URL alone.
 */
export function getSiteUrl(): string {
  const raw = env.SITE_URL ?? env.FRONTEND_ORIGIN ?? siteConfig.url;
  return raw.trim().replace(/\/+$/, "");
}

/** Absolute URL for a site path ("/feed") or an already absolute URL. */
export function siteUrl(pathname = "/"): string {
  if (/^https?:\/\//i.test(pathname)) return pathname;

  const base = getSiteUrl();
  const path = pathname.replace(/^\/+/, "");
  return path === "" ? `${base}/` : `${base}/${path}`;
}

/**
 * Turn a configured image reference into an absolute URL. Relative paths are
 * resolved against the canonical site URL because RSS readers and social
 * crawlers do not apply a document base to image links.
 */
export function shareImageUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : siteUrl(trimmed);
}

/**
 * Site-level share card defaults. Every value is a configuration item
 * (SITE_SHARE_* env vars) with a siteConfig fallback; per-page callers pass
 * overrides for the title/description/image of the thing being shared.
 */
export function getShareConfig(overrides: Partial<ShareConfig> = {}): ShareConfig {
  const title = env.SITE_SHARE_TITLE ?? siteConfig.title;
  const description = env.SITE_SHARE_DESCRIPTION ?? siteConfig.bio;
  const image = shareImageUrl(env.SITE_SHARE_IMAGE ?? siteConfig.shareImage);
  const card: ShareCard = env.SITE_SHARE_CARD ?? "summary_large_image";

  return {
    title: overrides.title?.trim() || title,
    description: overrides.description?.trim() || description,
    // undefined = keep the site default; null = this page explicitly has none.
    image: overrides.image !== undefined ? shareImageUrl(overrides.image) : image,
    card: overrides.card ?? card,
  };
}
