import crypto from "node:crypto";
import { env } from "@/server/env";
import { errors } from "./errors";

function presentedToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }
  return request.headers.get("x-cron-secret");
}

function tokensMatch(presented: string, expected: string): boolean {
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Gate for /api/internal/*. The endpoints stay hidden (404) unless
 * CRON_SECRET is configured, then require it via `Authorization: Bearer` or
 * `x-cron-secret`.
 */
export function requireCronSecret(request: Request): void {
  if (!env.CRON_SECRET) throw errors.notFound();

  const token = presentedToken(request);
  if (!token || !tokensMatch(token, env.CRON_SECRET)) {
    throw errors.unauthorized();
  }
}
