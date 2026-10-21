import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  friendLinkIdParams,
  updateFriendLinkInput,
} from "@/server/modules/friend-links/contracts";
import { getFriendLinksService } from "@/server/modules/friend-links";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = friendLinkIdParams.parse(await params);
      const input = updateFriendLinkInput.parse(await readJson(request));
      return getFriendLinksService().update(id, input);
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
      const { id } = friendLinkIdParams.parse(await params);
      return getFriendLinksService().remove(id);
    },
    { request },
  );
}
