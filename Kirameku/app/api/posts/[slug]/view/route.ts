import { handle } from "@/server/http/handler";
import { getClientIp } from "@/server/http/ip";
import { tryConsumeRateLimit } from "@/server/http/rate-limit";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { errors } from "@/server/http/errors";
import { getPostsService } from "@/server/modules/posts";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function parsePostId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw errors.badRequest("文章 ID 非法");
  }
  return id;
}

/**
 * Public view counter. The browser reports once per article per day, and the
 * server enforces the same rule per IP + article + day so prefetching, repeated
 * hydration, or a scripted client cannot inflate the number.
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
      const ip = getClientIp(request);
      const day = new Date().toISOString().slice(0, 10);

      const counted = tryConsumeRateLimit(
        `post-view:${ip}:${id}:${day}`,
        1,
        DAY_MS,
      );
      if (!counted) return { counted: false };

      const { views } = await getPostsService().incrementView(id);
      return { counted: true, views };
    },
    { request },
  );
}
