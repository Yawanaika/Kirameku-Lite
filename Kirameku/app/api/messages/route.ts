import { handle } from "@/server/http/handler";
import { enforceIpRateLimit } from "@/server/http/rate-limit";
import { readJson } from "@/server/http/body";
import { getClientIp } from "@/server/http/ip";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  createMessageInput,
  messageListQuery,
} from "@/server/modules/messages/contracts";
import { getMessagesService } from "@/server/modules/messages";
import { getNotificationsService } from "@/server/modules/notifications";
import { logError } from "@/server/http/logger";
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
      enforceIpRateLimit(request, "messages:create", 5, 10 * 60_000);
      const user = await requireGithubUser(request);
      const input = createMessageInput.parse(await readJson(request));

      const message = await getMessagesService().create({
        content: input.content,
        parentId: input.parent_id,
        ip: getClientIp(request),
        githubUserId: user.id,
      });

      try {
        await getNotificationsService().notify(
          {
            eventKey: "message.created",
            level: "info",
            title: input.parent_id ? "收到新的留言回复" : "收到新留言",
            body: message.content.slice(0, 4000),
            force: false,
            fields: [
              { label: "留言者", value: user.login.slice(0, 500) },
              { label: "留言 ID", value: String(message.id) },
              ...(input.parent_id
                ? [{ label: "回复留言", value: String(input.parent_id) }]
                : []),
            ],
          },
          { recordSkip: true },
        );
      } catch (error) {
        // The message is already saved; notification failures must not turn the
        // request into an error that could cause a duplicate submission.
        logError("发送新留言通知失败", error, { messageId: message.id });
      }

      return message;
    },
    { request },
  );
}
