import { errors } from "./errors";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

function getBucket(key: string, windowMs: number): Bucket {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  // Avoid unbounded growth from scans or spoofed keys.
  if (buckets.size > MAX_KEYS) {
    for (const [oldKey, value] of buckets) {
      if (now >= value.resetAt) buckets.delete(oldKey);
    }
  }

  return bucket;
}

function throwIfExceeded(bucket: Bucket, limit: number): void {
  if (bucket.count >= limit) {
    throw errors.rateLimited("请求过于频繁，请稍后再试", {
      retryAfterMs: Math.max(0, bucket.resetAt - Date.now()),
    });
  }
}

/**
 * Check a fixed-window counter without incrementing it. Use this for login and
 * other routes where only failures should count; increment with
 * `recordRateLimitFailure` when the attempt fails.
 */
export function assertRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): void {
  throwIfExceeded(getBucket(key, windowMs), limit);
}

/** Count one failed attempt. Successes do not consume the login budget. */
export function recordRateLimitFailure(key: string, windowMs: number): void {
  const bucket = getBucket(key, windowMs);
  bucket.count += 1;
}

/**
 * Single-process fixed-window limiter that counts every call. The deployment is
 * explicitly single-instance; if that changes this must move to Redis or
 * similar.
 */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): void {
  const bucket = getBucket(key, windowMs);
  throwIfExceeded(bucket, limit);
  bucket.count += 1;
}

/** Test helper; not used by production code. */
export function resetRateLimits(): void {
  buckets.clear();
}
