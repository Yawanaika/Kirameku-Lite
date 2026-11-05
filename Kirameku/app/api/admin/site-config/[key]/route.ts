import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  siteConfigKeyParams,
  updateSiteConfigInput,
} from "@/server/modules/site-config/contracts";
import { getSiteConfigService } from "@/server/modules/site-config";
import { revalidateSiteChrome } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { key } = siteConfigKeyParams.parse(await params);
      const input = updateSiteConfigInput.parse(await readJson(request));
      const result = await getSiteConfigService().update(key, input);
      revalidateSiteChrome();
      return result;
    },
    { request },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { key } = siteConfigKeyParams.parse(await params);
      const result = await getSiteConfigService().remove(key);
      revalidateSiteChrome();
      return result;
    },
    { request },
  );
}
