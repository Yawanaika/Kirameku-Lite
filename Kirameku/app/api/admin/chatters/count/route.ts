import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { adminChatterCountQuery } from "@/server/modules/chatters/contracts";
import { getChattersService } from "@/server/modules/chatters";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = adminChatterCountQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return { count: await getChattersService().adminCount(query.status) };
    },
    { request },
  );
}
