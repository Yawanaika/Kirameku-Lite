import { handle } from "@/server/http/handler";
import { getMessagesService } from "@/server/modules/messages";
import { messageListQuery } from "@/server/modules/messages/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      const query = messageListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getMessagesService().list(query);
    },
    { request },
  );
}
