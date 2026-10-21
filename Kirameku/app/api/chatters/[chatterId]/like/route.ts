import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { chatterParams } from "@/server/modules/chatters/contracts";
import { getChattersService } from "@/server/modules/chatters";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatterId: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      const { chatterId } = chatterParams.parse(await params);
      return getChattersService().toggleLike(chatterId, false);
    },
    { request },
  );
}
