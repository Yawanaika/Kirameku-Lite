import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { adminMessageCountQuery } from "@/server/modules/messages/contracts";
import { getMessagesService } from "@/server/modules/messages";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = adminMessageCountQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return { count: await getMessagesService().adminCount(query.status) };
    },
    { request },
  );
}
