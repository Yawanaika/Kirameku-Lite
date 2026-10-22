import "server-only";
import { cookies } from "next/headers";
import type { user as userTable } from "@/server/db/schema";
import { setAuditActor } from "@/server/http/audit-context";
import { errors } from "@/server/http/errors";
import { ADMIN_COOKIE } from "./constants";

export type AdminUser = typeof userTable.$inferSelect;

/**
 * Read and validate the admin session on every request. The token audience and
 * role are checked *and* the current database row must still be an admin, so a
 * stolen/forged GitHub token can never become an admin session.
 *
 * Auth/database modules are imported lazily: a request without a cookie (for
 * example `/admin` redirecting to the login page) must not load
 * `better-sqlite3` or the full Drizzle schema.
 */
export async function getAdminSession(): Promise<AdminUser | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const { verifyAdminToken } = await import("./session");
  const claims = await verifyAdminToken(token);
  if (!claims) return null;

  const id = Number(claims.sub);
  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const [{ getDb }, { user }, { eq }] = await Promise.all([
    import("@/server/db/client"),
    import("@/server/db/schema"),
    import("drizzle-orm"),
  ]);

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
  setAuditActor({ id: admin.id, username: admin.username });
  return admin;
}
