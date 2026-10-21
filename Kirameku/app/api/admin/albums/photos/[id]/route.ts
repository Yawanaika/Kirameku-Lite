import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { photoIdParams } from "@/server/modules/albums/contracts";
import { getAlbumsService } from "@/server/modules/albums";

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
      const { id } = photoIdParams.parse(await params);
      return getAlbumsService().removePhoto(id);
    },
    { request },
  );
}
