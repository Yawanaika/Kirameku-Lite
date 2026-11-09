import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { getPostsService } from "@/server/modules/posts";
import { postSnapshotSchema } from "@/server/modules/posts/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    assertWritable();
    assertSameOrigin(request);
    await requireAdmin();
    const snapshot = postSnapshotSchema.parse(await readJson(request));
    return getPostsService().saveDraft(null, snapshot);
  }, { request });
}
