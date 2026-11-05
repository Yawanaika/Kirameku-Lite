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
import { revalidateFriendLinks } from "@/lib/revalidate";

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
      const result = await getFriendLinksService().update(id, input);
      revalidateFriendLinks();
      return result;
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
      const result = await getFriendLinksService().remove(id);
      revalidateFriendLinks();
      return result;
    },
    { request },
  );
}
