import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { adminMessageIdParams } from "@/server/modules/messages/contracts";
import { getMessagesService } from "@/server/modules/messages";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = adminMessageIdParams.parse(await params);
      return getMessagesService().remove(id);
    },
    { request },
  );
}
