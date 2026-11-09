import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { getPostsService } from "@/server/modules/posts";
import { postIdParams, postSnapshotSchema } from "@/server/modules/posts/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = postIdParams.parse(await params);
    return getPostsService().getDraft(id);
  }, { request });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertWritable();
    assertSameOrigin(request);
    await requireAdmin();
    const { id } = postIdParams.parse(await params);
    const snapshot = postSnapshotSchema.parse(await readJson(request));
    return getPostsService().saveDraft(id, snapshot);
  }, { request });
}
