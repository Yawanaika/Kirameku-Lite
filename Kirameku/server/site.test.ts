import { beforeEach, describe, expect, it } from "vitest";
import { env } from "@/server/env";
import { siteConfig } from "@/siteConfig";
import { getShareConfig, getSiteUrl, shareImageUrl, siteUrl } from "./site";

beforeEach(() => {
  env.SITE_URL = undefined;
  env.FRONTEND_ORIGIN = "https://blog.example.com";
  env.SITE_SHARE_TITLE = undefined;
  env.SITE_SHARE_DESCRIPTION = undefined;
  env.SITE_SHARE_IMAGE = undefined;
  env.SITE_SHARE_CARD = undefined;
});

describe("getSiteUrl", () => {
  it("prefers SITE_URL over FRONTEND_ORIGIN", () => {
    env.SITE_URL = "https://example.test";

    expect(getSiteUrl()).toBe("https://example.test");
  });

  it("falls back to FRONTEND_ORIGIN and strips trailing slashes", () => {
    env.FRONTEND_ORIGIN = "https://blog.example.com/";

    expect(getSiteUrl()).toBe("https://blog.example.com");
  });

  it("falls back to siteConfig.url when nothing is configured", () => {
    env.FRONTEND_ORIGIN = undefined as unknown as string;

    expect(getSiteUrl()).toBe(siteConfig.url);
  });
});

describe("siteUrl", () => {
  it("joins a path onto the canonical origin", () => {
    env.SITE_URL = "https://blog.example.com";

    expect(siteUrl("/feed")).toBe("https://blog.example.com/feed");
    expect(siteUrl("feed")).toBe("https://blog.example.com/feed");
    expect(siteUrl("/")).toBe("https://blog.example.com/");
  });

  it("leaves absolute URLs untouched", () => {
    expect(siteUrl("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
  });
});

describe("shareImageUrl", () => {
  it("resolves site-relative images against the canonical origin", () => {
    env.SITE_URL = "https://blog.example.com";

    expect(shareImageUrl("/images/hong.jpg")).toBe(
      "https://blog.example.com/images/hong.jpg",
    );
  });

  it("returns null for blank values", () => {
    expect(shareImageUrl(undefined)).toBeNull();
    expect(shareImageUrl("   ")).toBeNull();
  });
});

describe("getShareConfig", () => {
  it("uses siteConfig defaults", () => {
    expect(getShareConfig()).toMatchObject({
      title: siteConfig.title,
      description: siteConfig.bio,
      image: `https://blog.example.com${siteConfig.shareImage}`,
      card: "summary_large_image",
    });
  });

  it("honours the SITE_SHARE_* configuration items", () => {
    env.SITE_SHARE_TITLE = "配置标题";
    env.SITE_SHARE_DESCRIPTION = "配置描述";
    env.SITE_SHARE_IMAGE = "https://cdn.example.com/card.png";
    env.SITE_SHARE_CARD = "summary";

    expect(getShareConfig()).toEqual({
      title: "配置标题",
      description: "配置描述",
      image: "https://cdn.example.com/card.png",
      card: "summary",
    });
  });

  it("applies per-page overrides and keeps the site image fallback", () => {
    const share = getShareConfig({ title: "文章标题", description: "" });

    expect(share.title).toBe("文章标题");
    expect(share.description).toBe(siteConfig.bio);
    expect(share.image).toBe(`https://blog.example.com${siteConfig.shareImage}`);
  });

  it("drops the image when a page explicitly passes null", () => {
    expect(getShareConfig({ image: null }).image).toBeNull();
  });
});
