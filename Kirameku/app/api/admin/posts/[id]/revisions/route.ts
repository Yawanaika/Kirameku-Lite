import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { getPostsService } from "@/server/modules/posts";
import { postIdParams } from "@/server/modules/posts/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = postIdParams.parse(await params);
    return getPostsService().listRevisions(id);
  }, { request });
}
