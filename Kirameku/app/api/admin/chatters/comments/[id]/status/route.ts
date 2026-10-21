import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  adminChatterCommentIdParams,
  updateCommentStatusInput,
} from "@/server/modules/comments/contracts";
import { getCommentsService } from "@/server/modules/comments";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = adminChatterCommentIdParams.parse(await params);
      const input = updateCommentStatusInput.parse(await readJson(request));
      return getCommentsService().updateChatterCommentStatus(id, input.status);
    },
    { request },
  );
}
