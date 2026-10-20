import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import { ADMIN_COOKIE, verifyAdminToken } from "./session";

export type AdminUser = typeof user.$inferSelect;

/**
 * Read and validate the admin session on every request. The token audience and
 * role are checked *and* the current database row must still be an admin, so a
 * stolen/forged GitHub token can never become an admin session.
 */
export async function getAdminSession(): Promise<AdminUser | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyAdminToken(token);
  if (!claims) return null;

  const id = Number(claims.sub);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const [admin] = await getDb()
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  return admin?.isAdmin ? admin : null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdminSession();
  if (!admin) throw errors.unauthorized();
  return admin;
}
