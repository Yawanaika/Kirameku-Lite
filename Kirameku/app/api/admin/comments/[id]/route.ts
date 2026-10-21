import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { adminCommentIdParams } from "@/server/modules/comments/contracts";
import { getCommentsService } from "@/server/modules/comments";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = adminCommentIdParams.parse(await params);
      return getCommentsService().removePostComment(id);
    },
    { request },
  );
}
