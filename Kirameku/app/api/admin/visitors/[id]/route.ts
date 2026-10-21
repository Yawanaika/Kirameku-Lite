import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { z } from "zod";
import { getVisitorsService } from "@/server/modules/visitors";

export const dynamic = "force-dynamic";

const visitorIdParams = z.object({
  id: z.coerce.number().int().min(1),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = visitorIdParams.parse(await params);
      return getVisitorsService().remove(id);
    },
    { request },
  );
}
