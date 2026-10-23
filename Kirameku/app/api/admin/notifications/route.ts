import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { getNotificationsService } from "@/server/modules/notifications";
import { getSchedulerStatus } from "@/server/modules/notifications/scheduler";

export const dynamic = "force-dynamic";

/** Channels, per-event rules, recent delivery log and scheduler health. */
export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const service = getNotificationsService();
      const state = await service.getState();
      return { ...state, scheduler: getSchedulerStatus() };
    },
    { request },
  );
}
