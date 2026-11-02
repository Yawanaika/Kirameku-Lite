import { describe, expect, it } from "vitest";
import { bypassImageOptimization } from "./image";

describe("bypassImageOptimization", () => {
  it("站内相对路径仍然交给优化器", () => {
    expect(bypassImageOptimization("/images/default-cover.jpg")).toBe(false);
    expect(bypassImageOptimization("/uploads/2026/01/a.png")).toBe(false);
    expect(bypassImageOptimization("#bg")).toBe(false);
  });

  it("http 与 https 外链绕过优化器", () => {
    expect(bypassImageOptimization("https://t.nsa.cc/d/BQAC")).toBe(true);
    expect(bypassImageOptimization("http://example.com/a.jpg")).toBe(true);
    expect(bypassImageOptimization("HTTPS://EXAMPLE.COM/A.JPG")).toBe(true);
  });

  it("协议相对地址视作外链", () => {
    expect(bypassImageOptimization("//cdn.example.com/a.png")).toBe(true);
  });

  it("GitHub 头像仍在可信名单内，继续走优化器", () => {
    expect(
      bypassImageOptimization("https://avatars.githubusercontent.com/u/12345?v=4"),
    ).toBe(false);
    expect(
      bypassImageOptimization("http://avatars.githubusercontent.com/u/12345"),
    ).toBe(false);
    expect(bypassImageOptimization("//avatars.githubusercontent.com/u/12345")).toBe(false);
    // 大小写混写也要命中
    expect(
      bypassImageOptimization("https://Avatars.GitHubUserContent.com/u/1"),
    ).toBe(false);
  });

  it("相似但不属于可信名单的域名照样绕过", () => {
    expect(bypassImageOptimization("https://avatars.githubusercontent.com.evil.com/u/1")).toBe(true);
    expect(bypassImageOptimization("https://evilavatars.githubusercontent.com/u/1")).toBe(true);
    expect(bypassImageOptimization("https://avatars.githubusercontent.com.cn/u/1")).toBe(true);
    expect(bypassImageOptimization("https://github.com/u/1.png")).toBe(true);
  });

  it("前后空白不影响判断", () => {
    expect(bypassImageOptimization("  https://example.com/a.jpg  ")).toBe(true);
    expect(bypassImageOptimization("  /images/a.jpg  ")).toBe(false);
  });

  it("空值不绕过", () => {
    expect(bypassImageOptimization(null)).toBe(false);
    expect(bypassImageOptimization(undefined)).toBe(false);
    expect(bypassImageOptimization("")).toBe(false);
    expect(bypassImageOptimization("   ")).toBe(false);
  });

  it("只是看起来像外链的路径不算外链", () => {
    expect(bypassImageOptimization("/http://example.com/a.jpg")).toBe(false);
    expect(bypassImageOptimization("example.com/a.jpg")).toBe(false);
  });
});
