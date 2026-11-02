import { describe, expect, it } from "vitest";
import {
  createDefaultNavDropdownConfig,
  isExternalHref,
  isInternalHref,
  isNavLinkActive,
  isSafeHref,
  NAV_DROPDOWN_MAX_LINKS,
  parseNavDropdownConfig,
} from "./nav-dropdown";

describe("parseNavDropdownConfig", () => {
  it("falls back to defaults for missing or broken values", () => {
    const expected = createDefaultNavDropdownConfig();
    expect(parseNavDropdownConfig(undefined)).toEqual(expected);
    expect(parseNavDropdownConfig(null)).toEqual(expected);
    expect(parseNavDropdownConfig("")).toEqual(expected);
    expect(parseNavDropdownConfig("not-json")).toEqual(expected);
    expect(parseNavDropdownConfig(42)).toEqual(expected);
  });

  it("parses a stored JSON string", () => {
    const config = parseNavDropdownConfig(
      JSON.stringify({
        enabled: true,
        label: "更多",
        icon: "compass",
        links: [
          { label: "GitHub", href: "https://github.com/yawanaika", description: "仓库" },
        ],
      }),
    );

    expect(config).toEqual({
      enabled: true,
      label: "更多",
      icon: "compass",
      links: [
        { label: "GitHub", href: "https://github.com/yawanaika", description: "仓库" },
      ],
    });
  });

  it("treats a bare link array as links and enables the menu", () => {
    const config = parseNavDropdownConfig([{ label: "文章", href: "/posts" }]);

    expect(config.enabled).toBe(true);
    expect(config.links).toEqual([{ label: "文章", href: "/posts", description: "" }]);
  });

  it("drops links that are missing fields or use an unsafe protocol", () => {
    const config = parseNavDropdownConfig({
      links: [
        { label: "关于", href: "/about" },
        { label: "恶意", href: "javascript:alert(1)" },
        { label: "数据", href: "data:text/html,hi" },
        { label: "", href: "/empty-label" },
        { href: "/no-label" },
        "nonsense",
        null,
      ],
    });

    expect(config.links.map((link) => link.href)).toEqual(["/about"]);
  });

  it("clamps link count, truncates text and rejects unknown icons", () => {
    const links = Array.from({ length: NAV_DROPDOWN_MAX_LINKS + 5 }, (_, index) => ({
      label: `link-${index}`,
      href: `/p/${index}`,
    }));

    const config = parseNavDropdownConfig({
      label: "x".repeat(80),
      icon: "not-an-icon",
      links,
    });

    expect(config.links).toHaveLength(NAV_DROPDOWN_MAX_LINKS);
    expect(config.label).toHaveLength(40);
    expect(config.icon).toBe("link");
    expect(config.enabled).toBe(true);
  });

  it("keeps an explicit disabled flag", () => {
    const config = parseNavDropdownConfig({
      enabled: false,
      links: [{ label: "关于", href: "/about" }],
    });

    expect(config.enabled).toBe(false);
    expect(config.links).toHaveLength(1);
  });

  it("supports the items alias used by older values", () => {
    const config = parseNavDropdownConfig({
      items: [{ name: "友链", url: "/friends" }],
    });

    expect(config.links).toEqual([{ label: "友链", href: "/friends", description: "" }]);
  });
});

describe("href helpers", () => {
  it("accepts internal and safe absolute addresses", () => {
    for (const href of ["/", "/posts", "#top", "https://example.com", "http://a.b", "//cdn.example.com", "mailto:hi@example.com", "tel:10086"]) {
      expect(isSafeHref(href)).toBe(true);
    }
  });

  it("rejects executable protocols and empty values", () => {
    for (const href of ["", "   ", "javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,hi", "posts/1", "vbscript:x"]) {
      expect(isSafeHref(href)).toBe(false);
    }
  });

  it("marks http(s) and protocol-relative links as external", () => {
    expect(isExternalHref("https://example.com")).toBe(true);
    expect(isExternalHref("//example.com")).toBe(true);
    expect(isExternalHref("/posts")).toBe(false);
    expect(isExternalHref("mailto:hi@example.com")).toBe(false);
  });

  it("marks site paths and anchors as internal", () => {
    expect(isInternalHref("/posts")).toBe(true);
    expect(isInternalHref("#top")).toBe(true);
    expect(isInternalHref("https://example.com")).toBe(false);
  });
});

describe("isNavLinkActive", () => {
  it("matches the exact path and its children", () => {
    expect(isNavLinkActive("/posts", "/posts")).toBe(true);
    expect(isNavLinkActive("/posts/hello", "/posts")).toBe(true);
    expect(isNavLinkActive("/posts-archive", "/posts")).toBe(false);
    expect(isNavLinkActive("/", "/")).toBe(true);
    expect(isNavLinkActive("/posts", "/")).toBe(false);
  });

  it("never matches external links or anchors", () => {
    expect(isNavLinkActive("/posts", "https://example.com")).toBe(false);
    expect(isNavLinkActive("/posts", "#top")).toBe(false);
  });
});
