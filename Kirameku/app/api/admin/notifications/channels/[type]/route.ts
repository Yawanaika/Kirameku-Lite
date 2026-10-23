import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  channelTypeParams,
  updateChannelInput,
} from "@/server/modules/notifications/contracts";
import { getNotificationsService } from "@/server/modules/notifications";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { type } = channelTypeParams.parse(await params);
      const input = updateChannelInput.parse(await readJson(request));
      return getNotificationsService().updateChannel(type, input);
    },
    { request },
  );
}
