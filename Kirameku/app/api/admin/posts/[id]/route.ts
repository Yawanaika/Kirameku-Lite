import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  postIdParams,
  updatePostInput,
} from "@/server/modules/posts/contracts";
import { getPostsService } from "@/server/modules/posts";
import { revalidatePosts } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      await requireAdmin();
      const { id } = postIdParams.parse(await params);
      return getPostsService().getById(id);
    },
    { request },
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = postIdParams.parse(await params);
      const input = updatePostInput.parse(await readJson(request));
      const result = await getPostsService().update(id, input);
      revalidatePosts();
      return result;
    },
    { request },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = postIdParams.parse(await params);
      const result = await getPostsService().remove(id);
      revalidatePosts();
      return result;
    },
    { request },
  );
}
