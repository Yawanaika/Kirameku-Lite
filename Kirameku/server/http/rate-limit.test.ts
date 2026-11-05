import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "./errors";
import {
  assertRateLimit,
  enforceIpRateLimit,
  enforceRateLimit,
  RATE_LIMIT_MAX_KEYS,
  rateLimitKeyCount,
  recordRateLimitFailure,
  resetRateLimits,
  tryConsumeRateLimit,
} from "./rate-limit";

describe("rate limit", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests under the limit and rejects the next one", () => {
    enforceRateLimit("login:1.2.3.4", 2, 60_000);
    enforceRateLimit("login:1.2.3.4", 2, 60_000);

    expect(() => enforceRateLimit("login:1.2.3.4", 2, 60_000)).toThrow(
      AppError,
    );
  });

  it("keeps keys isolated", () => {
    enforceRateLimit("login:a", 1, 60_000);
    expect(() => enforceRateLimit("login:b", 1, 60_000)).not.toThrow();
  });

  it("only consumes the login budget when a failure is recorded", () => {
    assertRateLimit("login:failed-only", 1, 60_000);
    expect(() => assertRateLimit("login:failed-only", 1, 60_000)).not.toThrow();

    recordRateLimitFailure("login:failed-only", 60_000);
    expect(() => assertRateLimit("login:failed-only", 1, 60_000)).toThrow(
      AppError,
    );
  });

  it("reports idempotent quota consumption without throwing", () => {
    expect(tryConsumeRateLimit("view:1", 1, 60_000)).toBe(true);
    expect(tryConsumeRateLimit("view:1", 1, 60_000)).toBe(false);
    expect(tryConsumeRateLimit("view:2", 1, 60_000)).toBe(true);
  });

  it("keeps the bucket map bounded even when every key is still live", () => {
    // 全是伪造 IP 也会立刻过期前打满窗口：以前只删过期项，
    // key 数量会无限增长，最终每个请求都要全表扫一遍。
    for (let index = 0; index < RATE_LIMIT_MAX_KEYS + 500; index += 1) {
      enforceRateLimit(`scan:${index}`, 1, 60_000);
    }

    expect(rateLimitKeyCount()).toBeLessThanOrEqual(RATE_LIMIT_MAX_KEYS);
    // 新来的 key 仍然被正常计数，只是把最老的挤出去
    expect(() => enforceRateLimit("scan:new", 1, 60_000)).not.toThrow();
  });

  it("keys public write limits per forwarded client IP", () => {
    const request = (ip: string) =>
      new Request("http://localhost/api/comments", {
        headers: { "x-forwarded-for": ip },
      });

    enforceIpRateLimit(request("1.2.3.4"), "comments:create", 1, 60_000);
    expect(() =>
      enforceIpRateLimit(request("1.2.3.4"), "comments:create", 1, 60_000),
    ).toThrow(AppError);
    expect(() =>
      enforceIpRateLimit(request("5.6.7.8"), "comments:create", 1, 60_000),
    ).not.toThrow();
  });
});
