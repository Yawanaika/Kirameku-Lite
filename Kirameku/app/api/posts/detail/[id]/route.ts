import { handle } from "@/server/http/handler";
import { errors } from "@/server/http/errors";
import { getPostsService } from "@/server/modules/posts";

export const dynamic = "force-dynamic";

function parsePostId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw errors.badRequest("文章 ID 非法");
  }
  return id;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      const { id } = await params;
      return getPostsService().getById(parsePostId(id), {
        publishedOnly: true,
      });
    },
    { request },
  );
}
