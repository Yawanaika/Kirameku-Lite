import { handle } from "@/server/http/handler";
import { readJson } from "@/server/http/body";
import { getClientIp } from "@/server/http/ip";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  createMessageInput,
  messageListQuery,
} from "@/server/modules/messages/contracts";
import { getMessagesService } from "@/server/modules/messages";
import { requireGithubUser } from "@/server/modules/github-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      const query = messageListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getMessagesService().list(query);
    },
    { request },
  );
}

export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      const user = await requireGithubUser(request);
      const input = createMessageInput.parse(await readJson(request));

      return getMessagesService().create({
        content: input.content,
        parentId: input.parent_id,
        ip: getClientIp(request),
        githubUserId: user.id,
      });
    },
    { request },
  );
}
