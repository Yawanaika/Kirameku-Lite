import { handle } from "@/server/http/handler";
import { getChattersService } from "@/server/modules/chatters";
import { chatterCountQuery } from "@/server/modules/chatters/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      const query = chatterCountQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return { count: await getChattersService().count(query.status) };
    },
    { request },
  );
}
