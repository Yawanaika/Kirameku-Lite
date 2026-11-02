import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultSiteSettings } from "@/lib/site-settings";
import { env } from "@/server/env";
import { siteConfig } from "@/siteConfig";
import {
  buildShareConfig,
  resolveSiteUrl,
  shareImageUrl,
  siteUrl,
} from "./site";

const BASE = "https://blog.example.com";

function settingsWithSiteUrl(url: string) {
  const settings = createDefaultSiteSettings();
  settings.profile.url = url;
  return settings;
}

beforeEach(() => {
  env.SITE_URL = undefined;
  env.FRONTEND_ORIGIN = BASE;
  env.SITE_SHARE_TITLE = undefined;
  env.SITE_SHARE_DESCRIPTION = undefined;
  env.SITE_SHARE_IMAGE = undefined;
  env.SITE_SHARE_CARD = undefined;
});

describe("resolveSiteUrl", () => {
  it("prefers SITE_URL over everything else", () => {
    env.SITE_URL = "https://example.test";

    expect(resolveSiteUrl(settingsWithSiteUrl("https://admin.test"))).toBe(
      "https://example.test",
    );
  });

  it("lets the admin-managed site url win over FRONTEND_ORIGIN", () => {
    expect(resolveSiteUrl(settingsWithSiteUrl("https://admin.test/"))).toBe(
      "https://admin.test",
    );
  });

  it("falls back to FRONTEND_ORIGIN and strips trailing slashes", () => {
    env.FRONTEND_ORIGIN = "https://blog.example.com/";

    expect(resolveSiteUrl(settingsWithSiteUrl(""))).toBe(BASE);
  });

  it("falls back to siteConfig.url when nothing is configured", () => {
    env.FRONTEND_ORIGIN = undefined as unknown as string;

    expect(resolveSiteUrl(settingsWithSiteUrl(""))).toBe(siteConfig.url);
  });
});

describe("siteUrl", () => {
  it("joins a path onto the canonical origin", () => {
    expect(siteUrl("/feed", BASE)).toBe("https://blog.example.com/feed");
    expect(siteUrl("feed", BASE)).toBe("https://blog.example.com/feed");
    expect(siteUrl("/", BASE)).toBe("https://blog.example.com/");
  });

  it("leaves absolute URLs untouched", () => {
    expect(siteUrl("https://cdn.example.com/a.png", BASE)).toBe(
      "https://cdn.example.com/a.png",
    );
  });
});

describe("shareImageUrl", () => {
  it("resolves site-relative images against the canonical origin", () => {
    expect(shareImageUrl("/images/hong.jpg", BASE)).toBe(
      "https://blog.example.com/images/hong.jpg",
    );
  });

  it("returns null for blank values", () => {
    expect(shareImageUrl(undefined, BASE)).toBeNull();
    expect(shareImageUrl("   ", BASE)).toBeNull();
  });
});

describe("buildShareConfig", () => {
  it("uses siteConfig defaults", () => {
    expect(
      buildShareConfig(createDefaultSiteSettings(), BASE),
    ).toMatchObject({
      title: siteConfig.title,
      description: siteConfig.bio,
      image: `${BASE}${siteConfig.shareImage}`,
      card: "summary_large_image",
    });
  });

  it("prefers the admin-managed settings over siteConfig", () => {
    const settings = createDefaultSiteSettings();
    settings.profile.siteTitle = "后台标题";
    settings.profile.bio = "后台简介";
    settings.share.image = "/images/admin-card.png";
    settings.share.card = "summary";

    expect(buildShareConfig(settings, BASE)).toEqual({
      title: "后台标题",
      description: "后台简介",
      image: "https://blog.example.com/images/admin-card.png",
      card: "summary",
    });
  });

  it("honours the SITE_SHARE_* configuration items", () => {
    env.SITE_SHARE_TITLE = "配置标题";
    env.SITE_SHARE_DESCRIPTION = "配置描述";
    env.SITE_SHARE_IMAGE = "https://cdn.example.com/card.png";
    env.SITE_SHARE_CARD = "summary";

    expect(buildShareConfig(createDefaultSiteSettings(), BASE)).toEqual({
      title: "配置标题",
      description: "配置描述",
      image: "https://cdn.example.com/card.png",
      card: "summary",
    });
  });

  it("resolves site-relative images against the admin-managed site url", () => {
    const settings = settingsWithSiteUrl("https://admin.test");

    expect(buildShareConfig(settings, resolveSiteUrl(settings)).image).toBe(
      `https://admin.test${siteConfig.shareImage}`,
    );
  });

  it("applies per-page overrides and keeps the site image fallback", () => {
    const share = buildShareConfig(createDefaultSiteSettings(), BASE, {
      title: "文章标题",
      description: "",
    });

    expect(share.title).toBe("文章标题");
    expect(share.description).toBe(siteConfig.bio);
    expect(share.image).toBe(`${BASE}${siteConfig.shareImage}`);
  });

  it("drops the image when a page explicitly passes null", () => {
    expect(
      buildShareConfig(createDefaultSiteSettings(), BASE, { image: null }).image,
    ).toBeNull();
  });
});
