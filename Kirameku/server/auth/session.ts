import { SignJWT, jwtVerify } from "jose";
import { env, getAuthSecret } from "@/server/env";
import {
  ADMIN_COOKIE,
  ADMIN_TTL_SECONDS,
  GITHUB_TOKEN_COOKIE,
  GITHUB_TOKEN_TTL_SECONDS,
} from "./constants";

export {
  ADMIN_COOKIE,
  ADMIN_TTL_SECONDS,
  GITHUB_STATE_COOKIE,
  GITHUB_STATE_TTL_SECONDS,
  GITHUB_TOKEN_COOKIE,
  GITHUB_TOKEN_TTL_SECONDS,
} from "./constants";

export interface AdminClaims {
  sub: string;
  aud: "admin";
  role: "admin";
  ver: 1;
}

export interface GithubClaims {
  sub: string;
  aud: "github";
  login: string;
  ver: 1;
}

export async function signAdminToken(userId: number): Promise<string> {
  return new SignJWT({ role: "admin", ver: 1 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setAudience("admin")
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function verifyAdminToken(
  token: string,
): Promise<AdminClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      audience: "admin",
      algorithms: ["HS256"],
    });
    if (
      payload.role !== "admin" ||
      payload.ver !== 1 ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      aud: "admin",
      role: "admin",
      ver: 1,
    };
  } catch {
    return null;
  }
}

export async function signGithubToken(
  userId: number,
  login: string,
): Promise<string> {
  return new SignJWT({ login, ver: 1 })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setAudience("github")
    .setIssuedAt()
    .setExpirationTime(`${GITHUB_TOKEN_TTL_SECONDS}s`)
    .sign(getAuthSecret());
}

export async function verifyGithubToken(
  token: string,
): Promise<GithubClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), {
      audience: "github",
      algorithms: ["HS256"],
    });
    if (
      payload.ver !== 1 ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      typeof payload.login !== "string" ||
      payload.login.length === 0
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      aud: "github",
      login: payload.login,
      ver: 1,
    };
  } catch {
    return null;
  }
}

export function adminCookie(token: string): string {
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ADMIN_TTL_SECONDS}`,
  ];
  if (env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearAdminCookie(): string {
  const parts = [
    `${ADMIN_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function githubCookie(token: string): string {
  const parts = [
    `${GITHUB_TOKEN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${GITHUB_TOKEN_TTL_SECONDS}`,
  ];
  if (env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearGithubCookie(): string {
  const parts = [
    `${GITHUB_TOKEN_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}
