import { env } from "@/server/env";
import {
  GITHUB_STATE_COOKIE,
  GITHUB_STATE_TTL_SECONDS,
} from "./constants";

function cookieParts(value: string, maxAge: number): string {
  const parts = [
    `${GITHUB_STATE_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/api/auth/github",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function githubStateCookie(state: string): string {
  return cookieParts(state, GITHUB_STATE_TTL_SECONDS);
}

export function clearGithubStateCookie(): string {
  return cookieParts("", 0);
}

export function readGithubStateCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== GITHUB_STATE_COOKIE) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}
