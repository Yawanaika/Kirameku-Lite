import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  albumIdParams,
  updateAlbumInput,
} from "@/server/modules/albums/contracts";
import { getAlbumsService } from "@/server/modules/albums";

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
      const { id } = albumIdParams.parse(await params);
      const input = updateAlbumInput.parse(await readJson(request));
      return getAlbumsService().update(id, input);
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
      const { id } = albumIdParams.parse(await params);
      return getAlbumsService().remove(id);
    },
    { request },
  );
}
