import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  tagIdParams,
  updateTagInput,
} from "@/server/modules/tags/contracts";
import { getTagsService } from "@/server/modules/tags";
import { revalidateTaxonomy } from "@/lib/revalidate";

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
      const { id } = tagIdParams.parse(await params);
      const input = updateTagInput.parse(await readJson(request));
      const result = await getTagsService().update(id, input);
      revalidateTaxonomy();
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
      const { id } = tagIdParams.parse(await params);
      const result = await getTagsService().remove(id);
      revalidateTaxonomy();
      return result;
    },
    { request },
  );
}
