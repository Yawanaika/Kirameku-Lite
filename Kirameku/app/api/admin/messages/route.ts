import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { adminMessageListQuery } from "@/server/modules/messages/contracts";
import { getMessagesService } from "@/server/modules/messages";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = adminMessageListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getMessagesService().listAdmin(query);
    },
    { request },
  );
}
