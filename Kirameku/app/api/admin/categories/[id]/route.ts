import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  categoryIdParams,
  updateCategoryInput,
} from "@/server/modules/categories/contracts";
import { getCategoriesService } from "@/server/modules/categories";
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
      const { id } = categoryIdParams.parse(await params);
      const input = updateCategoryInput.parse(await readJson(request));
      const result = await getCategoriesService().update(id, input);
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
      const { id } = categoryIdParams.parse(await params);
      const result = await getCategoriesService().remove(id);
      revalidateTaxonomy();
      return result;
    },
    { request },
  );
}
