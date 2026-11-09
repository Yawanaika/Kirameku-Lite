import { handle } from "@/server/http/handler";
import { getVisitorKey } from "@/server/http/visitor-key";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
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

/**
 * Public view counter. The browser reports once per article per day, and the
 * server enforces the same rule per visitor key + article + UTC day so repeated
 * hydration, prefetching, or a scripted client cannot inflate the number.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);

      // Public URLs keep the legacy `[slug]` segment name, but the client
      // sends the numeric post id here (same as `/api/posts/{id}/like`).
      const { slug: rawId } = await params;
      const id = parsePostId(rawId);
      const visitorKey = getVisitorKey(request);
      const day = new Date().toISOString().slice(0, 10);
      return getPostsService().incrementView(id, visitorKey, day);
    },
    { request },
  );
}
