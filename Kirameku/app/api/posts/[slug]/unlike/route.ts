import { handle } from "@/server/http/handler";
import { errors } from "@/server/http/errors";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { getPostsService } from "@/server/modules/posts";

export const dynamic = "force-dynamic";

function parsePostId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw errors.badRequest("文章 ID 非法");
  }
  return id;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      const { slug } = await params;
      return getPostsService().like(parsePostId(slug), true);
    },
    { request },
  );
}
