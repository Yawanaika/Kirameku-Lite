import { z } from "zod";
import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { getPostsService } from "@/server/modules/posts";
import { postIdParams } from "@/server/modules/posts/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; revisionId: string }> }) {
  return handle(async () => {
    assertWritable();
    assertSameOrigin(request);
    await requireAdmin();
    const { id } = postIdParams.parse(await params);
    const { revisionId } = await params;
    const version = z.coerce.number().int().positive().parse(revisionId);
    return getPostsService().restoreRevision(id, version);
  }, { request });
}
