import { requireCronSecret } from "@/server/http/internal-auth";
import { handle } from "@/server/http/handler";
import { getMetrics } from "@/server/http/metrics";

/**
 * Internal metrics for cron/load-test tooling. The endpoint is hidden unless
 * CRON_SECRET is configured, and it is never linked from public pages.
 */
export async function GET(request: Request) {
  return handle(
    async () => {
      requireCronSecret(request);

      return Response.json(getMetrics(), {
        headers: { "cache-control": "no-store" },
      });
    },
    { request },
  );
}
