import { handle } from "@/server/http/handler";
import { enforceIpRateLimit } from "@/server/http/rate-limit";
import { readJson } from "@/server/http/body";
import { getClientIp } from "@/server/http/ip";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { createPostCommentInput } from "@/server/modules/comments/contracts";
import { getCommentsService } from "@/server/modules/comments";
import { requireGithubUser } from "@/server/modules/github-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      enforceIpRateLimit(request, "comments:create", 5, 10 * 60_000);
      const user = await requireGithubUser(request);
      const input = createPostCommentInput.parse(await readJson(request));

      return getCommentsService().createPostComment({
        postId: input.post_id,
        parentId: input.parent_id,
        content: input.content,
        ip: getClientIp(request),
        githubUserId: user.id,
      });
    },
    { request },
  );
}
