import "server-only";
import type { SiteSettings } from "@/lib/site-settings";
import { env } from "@/server/env";
import { loadSiteSettings } from "@/server/modules/site-settings";
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
 * Resolution order is SITE_URL -> 后台「站点设置」里的站点地址 -> FRONTEND_ORIGIN
 * -> siteConfig.url: SITE_URL wins for a deployment that needs to override
 * everything, the admin value covers the everyday "my domain changed" case
 * without touching the container, and FRONTEND_ORIGIN keeps a plain deployment
 * working with a single variable.
 */
export function resolveSiteUrl(settings: SiteSettings): string {
  const raw =
    env.SITE_URL ??
    (settings.profile.url || undefined) ??
    env.FRONTEND_ORIGIN ??
    siteConfig.url;
  return raw.trim().replace(/\/+$/, "");
}

/** Same as {@link resolveSiteUrl} but reads the admin-managed settings first. */
export async function getSiteUrl(): Promise<string> {
  return resolveSiteUrl(await loadSiteSettings());
}

/** Absolute URL for a site path ("/feed") or an already absolute URL. */
export function siteUrl(pathname: string, base: string): string {
  if (/^https?:\/\//i.test(pathname)) return pathname;

  const path = pathname.replace(/^\/+/, "");
  return path === "" ? `${base}/` : `${base}/${path}`;
}

/**
 * Turn a configured image reference into an absolute URL. Relative paths are
 * resolved against the canonical site URL because RSS readers and social
 * crawlers do not apply a document base to image links.
 */
export function shareImageUrl(
  value: string | null | undefined,
  base: string,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : siteUrl(trimmed, base);
}

/**
 * Site-level share card defaults derived from an already-loaded settings
 * object. Every value is a configuration item: the SITE_SHARE_* env vars win,
 * then the admin-managed site settings, which themselves fall back to
 * siteConfig when the database has nothing.
 */
export function buildShareConfig(
  settings: SiteSettings,
  base: string,
  overrides: Partial<ShareConfig> = {},
): ShareConfig {
  const title = env.SITE_SHARE_TITLE ?? settings.profile.siteTitle;
  const description = env.SITE_SHARE_DESCRIPTION ?? settings.profile.bio;
  const image = shareImageUrl(env.SITE_SHARE_IMAGE ?? settings.share.image, base);
  const card: ShareCard = env.SITE_SHARE_CARD ?? settings.share.card;

  return {
    title: overrides.title?.trim() || title,
    description: overrides.description?.trim() || description,
    // undefined = keep the site default; null = this page explicitly has none.
    image:
      overrides.image !== undefined
        ? shareImageUrl(overrides.image, base)
        : image,
    card: overrides.card ?? card,
  };
}

/**
 * Share card defaults for the whole site, reading the admin-managed settings.
 *
 * Per-page callers pass overrides for the title/description/image of the thing
 * being shared.
 */
export async function getShareConfig(
  overrides: Partial<ShareConfig> = {},
  base?: string,
): Promise<ShareConfig> {
  const settings = await loadSiteSettings();
  return buildShareConfig(settings, base ?? resolveSiteUrl(settings), overrides);
}
