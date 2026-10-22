import crypto from "node:crypto";
import { env } from "@/server/env";
import { errors } from "@/server/http/errors";
import { handle } from "@/server/http/handler";
import { getMetrics } from "@/server/http/metrics";

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
 * Internal metrics for cron/load-test tooling. The endpoint is hidden unless
 * CRON_SECRET is configured, and it is never linked from public pages.
 */
export async function GET(request: Request) {
  return handle(
    async () => {
      if (!env.CRON_SECRET) throw errors.notFound();

      const token = presentedToken(request);
      if (!token || !tokensMatch(token, env.CRON_SECRET)) {
        throw errors.unauthorized();
      }

      return Response.json(getMetrics(), {
        headers: { "cache-control": "no-store" },
      });
    },
    { request },
  );
}
