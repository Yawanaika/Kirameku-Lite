import { handle } from "@/server/http/handler";
import { getCommentsService } from "@/server/modules/comments";
import { postCommentsParams } from "@/server/modules/comments/contracts";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  return handle(
    async () => {
      const { postId } = postCommentsParams.parse(await params);
      return getCommentsService().listPostComments(postId);
    },
    { request },
  );
}
