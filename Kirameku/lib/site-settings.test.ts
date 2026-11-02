import { describe, expect, it } from "vitest";
import {
  createDefaultSiteSettings,
  isSafeAssetUrl,
  isSafeSettingsLink,
  parseSiteSettings,
  SITE_SETTINGS_LIMITS,
} from "./site-settings";

describe("parseSiteSettings", () => {
  it("falls back to defaults for missing or broken values", () => {
    const expected = createDefaultSiteSettings();
    expect(parseSiteSettings(undefined)).toEqual(expected);
    expect(parseSiteSettings(null)).toEqual(expected);
    expect(parseSiteSettings("")).toEqual(expected);
    expect(parseSiteSettings("not-json")).toEqual(expected);
    expect(parseSiteSettings(42)).toEqual(expected);
    expect(parseSiteSettings([])).toEqual(expected);
  });

  it("reads a stored JSON string and normalises each group", () => {
    const defaults = createDefaultSiteSettings();
    const settings = parseSiteSettings(
      JSON.stringify({
        profile: {
          siteTitle: "  新标题  ",
          authorName: "站长",
          bio: "简介",
          avatarUrl: "/images/a.png",
          buildDate: "2026-10-22T12:00:00",
          social: { github: "https://github.com/x", email: "a@b.c" },
        },
        appearance: {
          useGradient: true,
          themeColors: ["#fff", "#000000"],
          bgImages: ["/images/1.webp"],
        },
        share: { image: "/images/s.png", card: "summary" },
        content: { chatterTitle: "留言", footerBadges: [{ name: "Next", color: "text-sky-500" }] },
        music: { playlistId: "123", trackIds: ["9", "8"] },
      }),
    );

    expect(settings.profile.siteTitle).toBe("新标题");
    expect(settings.profile.social.github).toBe("https://github.com/x");
    // 缺省的社交项回落到出厂默认值。
    expect(settings.profile.social.tg).toBe(defaults.profile.social.tg);
    expect(settings.appearance.useGradient).toBe(true);
    expect(settings.appearance.themeColors).toEqual(["#fff", "#000000"]);
    expect(settings.share.card).toBe("summary");
    expect(settings.content.footerBadges).toEqual([
      { name: "Next", color: "text-sky-500" },
    ]);
    expect(settings.music.trackIds).toEqual(["9", "8"]);
  });

  it("drops unsafe asset urls and links", () => {
    const defaults = createDefaultSiteSettings();
    const settings = parseSiteSettings({
      profile: {
        avatarUrl: "javascript:alert(1)",
        social: { github: "javascript:alert(1)" },
      },
      appearance: {
        bgImages: ["javascript:alert(1)", "data:text/html,x"],
        themeColors: ["red", "#12"],
      },
      share: { image: "data:text/html,x" },
    });

    expect(settings.profile.avatarUrl).toBe(defaults.profile.avatarUrl);
    expect(settings.profile.social.github).toBe(defaults.profile.social.github);
    expect(settings.appearance.bgImages).toEqual(defaults.appearance.bgImages);
    expect(settings.appearance.themeColors).toEqual(defaults.appearance.themeColors);
    expect(settings.share.image).toBe(defaults.share.image);
  });

  it("requires at least two colours and one background image", () => {
    const defaults = createDefaultSiteSettings();
    const settings = parseSiteSettings({
      appearance: { themeColors: ["#fff"], bgImages: [] },
    });

    expect(settings.appearance.themeColors).toEqual(defaults.appearance.themeColors);
    expect(settings.appearance.bgImages).toEqual(defaults.appearance.bgImages);
  });

  it("keeps only numeric music ids and drops duplicates", () => {
    const settings = parseSiteSettings({
      music: { trackIds: ["12", 12, "abc", " 34 "] },
    });

    expect(settings.music.trackIds).toEqual(["12", "34"]);
  });

  it("rejects badge colours that are not tailwind classes", () => {
    const settings = parseSiteSettings({
      content: { footerBadges: [{ name: "坏", color: "javascript:alert(1)" }] },
    });

    expect(settings.content.footerBadges).toEqual(
      createDefaultSiteSettings().content.footerBadges,
    );
  });

  it("truncates over-long text fields", () => {
    const settings = parseSiteSettings({
      profile: { authorName: "x".repeat(SITE_SETTINGS_LIMITS.authorName + 20) },
    });

    expect(settings.profile.authorName).toHaveLength(
      SITE_SETTINGS_LIMITS.authorName,
    );
  });
});

describe("url guards", () => {
  it("accepts only root-relative, protocol-relative and http(s) assets", () => {
    expect(isSafeAssetUrl("/images/a.png")).toBe(true);
    expect(isSafeAssetUrl("//cdn.example.com/a.png")).toBe(true);
    expect(isSafeAssetUrl("https://example.com/a.png")).toBe(true);
    expect(isSafeAssetUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeAssetUrl("data:text/html,x")).toBe(false);
    expect(isSafeAssetUrl("")).toBe(false);
  });

  it("allows settings links to be empty", () => {
    expect(isSafeSettingsLink("")).toBe(true);
    expect(isSafeSettingsLink("/about")).toBe(true);
    expect(isSafeSettingsLink("https://example.com")).toBe(true);
    expect(isSafeSettingsLink("javascript:alert(1)")).toBe(false);
  });
});
