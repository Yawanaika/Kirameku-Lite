import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { adminCommentListQuery } from "@/server/modules/comments/contracts";
import { getCommentsService } from "@/server/modules/comments";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = adminCommentListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getCommentsService().listAdminComments(query);
    },
    { request },
  );
}
