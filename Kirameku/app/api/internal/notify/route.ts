import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { requireCronSecret } from "@/server/http/internal-auth";
import { internalNotifyInput } from "@/server/modules/notifications/contracts";
import { getNotificationsService } from "@/server/modules/notifications";

export const dynamic = "force-dynamic";

/**
 * Open alerting endpoint for external probes (uptime monitors, CI, other
 * services). Requires CRON_SECRET, applies the per-event cooldown unless
 * `force` is set, and records every attempt in the delivery log.
 */
export async function POST(request: Request) {
  return handle(
    async () => {
      requireCronSecret(request);
      const input = internalNotifyInput.parse(await readJson(request));
      const result = await getNotificationsService().notify(input, {
        recordSkip: true,
      });
      return result;
    },
    { request },
  );
}
