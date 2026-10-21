import { handle } from "@/server/http/handler";
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
      const { messageId } = messageIdParams.parse(await params);
      return getMessagesService().toggleLike(messageId, false);
    },
    { request },
  );
}
