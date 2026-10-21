import { handle } from "@/server/http/handler";
import { readJson } from "@/server/http/body";
import { getClientIp } from "@/server/http/ip";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { createChatterCommentInput } from "@/server/modules/comments/contracts";
import { getCommentsService } from "@/server/modules/comments";
import { requireGithubUser } from "@/server/modules/github-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      const user = await requireGithubUser(request);
      const input = createChatterCommentInput.parse(await readJson(request));

      return getCommentsService().createChatterComment({
        chatterId: input.chatter_id,
        parentId: input.parent_id,
        content: input.content,
        ip: getClientIp(request),
        githubUserId: user.id,
      });
    },
    { request },
  );
}
