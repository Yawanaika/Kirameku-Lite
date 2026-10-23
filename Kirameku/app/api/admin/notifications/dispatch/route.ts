import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { dispatchInput } from "@/server/modules/notifications/contracts";
import { getNotificationsService } from "@/server/modules/notifications";

export const dynamic = "force-dynamic";

/**
 * Manual push from the admin UI: sends to the selected channels right away,
 * bypassing the event switch and the cooldown.
 */
export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const input = dispatchInput.parse(await readJson(request));
      const result = await getNotificationsService().notify({
        ...input,
        eventKey: "manual",
        force: true,
        fields: [],
      });

      const failed = result.outcomes.filter((outcome) => !outcome.ok);
      return {
        sent: result.sent,
        reason: result.reason ?? "",
        outcomes: result.outcomes,
        failed: failed.length,
      };
    },
    { request },
  );
}
