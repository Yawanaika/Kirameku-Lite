/**
 * Compatibility alias for the legacy upload path. New code uses
 * `/api/admin/upload/image`; this route exists for one release cycle.
 */
export { POST } from "@/app/api/admin/upload/image/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
