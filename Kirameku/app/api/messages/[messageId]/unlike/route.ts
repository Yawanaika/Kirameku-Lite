import { handle } from "@/server/http/handler";
import { enforceIpRateLimit } from "@/server/http/rate-limit";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { messageIdParams } from "@/server/modules/messages/contracts";
import { getMessagesService } from "@/server/modules/messages";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      enforceIpRateLimit(request, "message-like", 30, 60_000);
      const { messageId } = messageIdParams.parse(await params);
      return getMessagesService().toggleLike(messageId, true);
    },
    { request },
  );
}
