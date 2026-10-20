import { env } from "@/server/env";
import { errors } from "./errors";

/**
 * Route Handler CSRF check for cookie-authenticated writes.
 *
 * Browsers send Origin on cross-site and most same-site writes. Non-browser
 * clients may omit it; if it is present it must match the request host or the
 * explicitly configured public origin (useful behind a reverse proxy that
 * rewrites Host).
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const host = request.headers.get("host");
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw errors.forbidden("非法 Origin");
  }

  const configuredOrigin = new URL(env.FRONTEND_ORIGIN).origin;
  const hostMatches = host !== null && parsed.host === host;
  if (!hostMatches && parsed.origin !== configuredOrigin) {
    throw errors.forbidden("跨站请求被拒绝");
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw errors.forbidden("跨站请求被拒绝");
  }
}
