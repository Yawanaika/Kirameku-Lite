import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { logListQuery } from "@/server/modules/notifications/contracts";
import { getNotificationsService } from "@/server/modules/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = logListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getNotificationsService().listLogs(query);
    },
    { request },
  );
}
