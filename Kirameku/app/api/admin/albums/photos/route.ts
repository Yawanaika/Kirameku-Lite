import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { createPhotoInput } from "@/server/modules/albums/contracts";
import { getAlbumsService } from "@/server/modules/albums";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const input = createPhotoInput.parse(await readJson(request));
      return getAlbumsService().addPhoto(input);
    },
    { request },
  );
}
