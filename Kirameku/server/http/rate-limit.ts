import { errors } from "./errors";
import { getClientIp } from "./ip";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;
/** 每插入这么多次才做一次过期清理，避免每个请求都全表扫描。 */
const SWEEP_EVERY = 1_000;
let insertsSinceSweep = 0;

function sweepExpired(now: number): void {
  for (const [key, value] of buckets) {
    if (now >= value.resetAt) buckets.delete(key);
  }
}

function getBucket(key: string, windowMs: number): Bucket {
  const now = Date.now();
  let bucket = buckets.get(key);
  const isNew = !bucket || now >= bucket.resetAt;

  if (!bucket || isNew) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  // 防被扫描/伪造 IP 打爆内存：Map 的迭代顺序就是插入顺序，
  // 超限时淘汰最老的 key。每来一个新 key 只删一个，成本 O(1)；
  // 老实现是每次全表扫描找过期项，key 多时自己就把 CPU 打满了。
  if (isNew) {
    insertsSinceSweep += 1;
    if (buckets.size > MAX_KEYS) {
      const oldest = buckets.keys().next();
      if (!oldest.done && oldest.value !== key) buckets.delete(oldest.value);
    }
    if (insertsSinceSweep >= SWEEP_EVERY) {
      insertsSinceSweep = 0;
      sweepExpired(now);
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

/**
 * Route-level limit keyed by client IP. Used by public write endpoints so the
 * same budget is shared between `/like` and `/unlike` variants.
 */
export function enforceIpRateLimit(
  request: Request,
  route: string,
  limit: number,
  windowMs: number,
): void {
  enforceRateLimit(`${route}:${getClientIp(request)}`, limit, windowMs);
}

/**
 * Consume one unit of quota and report whether it was available. Unlike
 * `enforceRateLimit` this never throws, so it can back idempotent writes such
 * as "count this article view at most once per day per client".
 */
export function tryConsumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const bucket = getBucket(key, windowMs);
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Test helper; not used by production code. */
export function resetRateLimits(): void {
  buckets.clear();
  insertsSinceSweep = 0;
}

/** Test helper; reports how many keys the limiter is currently tracking. */
export function rateLimitKeyCount(): number {
  return buckets.size;
}

/** Exposed for tests so the cap assertion does not hard-code the constant. */
export const RATE_LIMIT_MAX_KEYS = MAX_KEYS;
