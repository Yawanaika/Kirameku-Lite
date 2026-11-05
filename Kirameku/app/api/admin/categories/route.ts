import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { createCategoryInput } from "@/server/modules/categories/contracts";
import { getCategoriesService } from "@/server/modules/categories";
import { revalidateTaxonomy } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      return getCategoriesService().list();
    },
    { request },
  );
}

export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const input = createCategoryInput.parse(await readJson(request));
      const result = await getCategoriesService().create(input);
      revalidateTaxonomy();
      return result;
    },
    { request },
  );
}
