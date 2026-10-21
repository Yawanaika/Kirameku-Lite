import { handle } from "@/server/http/handler";
import { getCommentsService } from "@/server/modules/comments";
import { chatterCommentsParams } from "@/server/modules/comments/contracts";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatterId: string }> },
) {
  return handle(
    async () => {
      const { chatterId } = chatterCommentsParams.parse(await params);
      return getCommentsService().listChatterComments(chatterId);
    },
    { request },
  );
}
