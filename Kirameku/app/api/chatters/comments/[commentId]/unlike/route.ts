import { handle } from "@/server/http/handler";
import { enforceIpRateLimit } from "@/server/http/rate-limit";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { commentIdParams } from "@/server/modules/comments/contracts";
import { getCommentsService } from "@/server/modules/comments";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      enforceIpRateLimit(request, "chatter-comment-like", 30, 60_000);
      const { commentId } = commentIdParams.parse(await params);
      return getCommentsService().toggleChatterCommentLike(commentId, true);
    },
    { request },
  );
}
