import { handle } from "@/server/http/handler";
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
      const { commentId } = commentIdParams.parse(await params);
      return getCommentsService().togglePostCommentLike(commentId, true);
    },
    { request },
  );
}
