import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { createFriendLinkInput } from "@/server/modules/friend-links/contracts";
import { getFriendLinksService } from "@/server/modules/friend-links";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      return getFriendLinksService().listAll();
    },
    { request },
  );
}

export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const input = createFriendLinkInput.parse(await readJson(request));
      return getFriendLinksService().create(input);
    },
    { request },
  );
}
