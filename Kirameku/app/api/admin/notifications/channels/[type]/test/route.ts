import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { channelTypeParams } from "@/server/modules/notifications/contracts";
import { getNotificationsService } from "@/server/modules/notifications";

export const dynamic = "force-dynamic";

/** Send a real test message so the admin can verify the channel config. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { type } = channelTypeParams.parse(await params);
      return getNotificationsService().testChannel(type);
    },
    { request },
  );
}
