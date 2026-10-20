import { SignJWT, jwtVerify } from "jose";
import { env, getAuthSecret } from "@/server/env";

export const ADMIN_COOKIE = "kir_admin";
export const ADMIN_TTL_SECONDS = 72 * 60 * 60;

export interface AdminClaims {
  sub: string;
  aud: "admin";
  role: "admin";
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
