import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "./errors";
import {
  assertRateLimit,
  enforceRateLimit,
  recordRateLimitFailure,
  resetRateLimits,
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
});
