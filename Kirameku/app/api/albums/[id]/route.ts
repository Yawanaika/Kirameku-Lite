import { handle } from "@/server/http/handler";
import { albumIdParams } from "@/server/modules/albums/contracts";
import { getAlbumsService } from "@/server/modules/albums";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      const { id } = albumIdParams.parse(await params);
      return getAlbumsService().getById(id);
    },
    { request },
  );
}
