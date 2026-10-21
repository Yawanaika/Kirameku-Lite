import { handle } from "@/server/http/handler";
import { getChattersService } from "@/server/modules/chatters";
import { chatterListQuery } from "@/server/modules/chatters/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      const query = chatterListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getChattersService().list(query);
    },
    { request },
  );
}
