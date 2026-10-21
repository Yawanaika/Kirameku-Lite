import { handle } from "@/server/http/handler";
import { getAlbumsService } from "@/server/modules/albums";
import { albumIdParams } from "@/server/modules/albums/contracts";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      const { id } = albumIdParams.parse(await params);
      return getAlbumsService().listPhotos(id);
    },
    { request },
  );
}
