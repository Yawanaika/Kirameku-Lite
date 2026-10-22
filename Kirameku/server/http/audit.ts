import "server-only";
import type { AuditActor } from "./audit-context";
import { getClientIp } from "./ip";
import { logError } from "./logger";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXCLUDED_PATHS = new Set(["/api/admin/markdown/preview"]);

export interface AdminRequestAuditInput {
  request?: Request;
  response: Response;
  actor?: AuditActor;
  result?: unknown;
}

/**
 * Derive a stable action name from the HTTP method and the admin path. Most
 * routes map directly; the special cases are status toggles, uploads, settings
 * upserts and clearing all visitor records.
 */
export function deriveAuditAction(method: string, pathname: string): string {
  if (pathname.endsWith("/status")) return "status";
  if (pathname.endsWith("/upload/image")) return "upload";
  if (
    pathname === "/api/admin/site-config" ||
    pathname.startsWith("/api/admin/site-config/")
  ) {
    return "update";
  }
  if (method === "DELETE" && pathname === "/api/admin/visitors") return "clear";

  if (method === "POST") return "create";
  if (method === "DELETE") return "delete";
  return "update";
}

export function deriveAuditTarget(
  pathname: string,
  result?: unknown,
): {
  targetType: string;
  targetId: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const targetType = segments[2] ?? "admin";
  const pathId =
    [...segments].reverse().find((segment) => /^\d+$/.test(segment)) ?? "";

  if (pathId) return { targetType, targetId: pathId };

  if (result && typeof result === "object" && !Array.isArray(result)) {
    const id = (result as { id?: unknown }).id;
    if (typeof id === "number" || typeof id === "string") {
      return { targetType, targetId: String(id) };
    }
  }

  return { targetType, targetId: "" };
}

/**
 * Best-effort audit write for a successful admin mutation. It must never turn
 * a successful response into an error, so every failure is logged and ignored.
 */
export async function recordAdminRequestAudit({
  request,
  response,
  actor,
  result,
}: AdminRequestAuditInput): Promise<void> {
  try {
    if (!request || !actor) return;

    const method = request.method.toUpperCase();
    if (!WRITE_METHODS.has(method)) return;

    const { pathname } = new URL(request.url);
    if (!pathname.startsWith("/api/admin/")) return;
    if (EXCLUDED_PATHS.has(pathname)) return;
    if (response.status < 200 || response.status >= 300) return;

    const { targetType, targetId } = deriveAuditTarget(pathname, result);
    const { getAuditService } = await import("@/server/modules/audit");

    await getAuditService().record({
      actorId: actor.id,
      action: deriveAuditAction(method, pathname),
      targetType,
      targetId,
      detail: {
        method,
        path: pathname,
        status: response.status,
      },
      ip: getClientIp(request),
    });
  } catch (error) {
    logError("Failed to write admin audit log", error);
  }
}
