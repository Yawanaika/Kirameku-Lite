import { handle } from "@/server/http/handler";
import { getMessagesService } from "@/server/modules/messages";
import { messageCountQuery } from "@/server/modules/messages/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      messageCountQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return { count: await getMessagesService().count() };
    },
    { request },
  );
}
