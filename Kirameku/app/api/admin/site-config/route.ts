import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  batchSiteConfigInput,
  createSiteConfigInput,
} from "@/server/modules/site-config/contracts";
import { getSiteConfigService } from "@/server/modules/site-config";
import { revalidateSiteChrome } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      return getSiteConfigService().listAll();
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
      const input = createSiteConfigInput.parse(await readJson(request));
      const result = await getSiteConfigService().create(input);
      revalidateSiteChrome();
      return result;
    },
    { request },
  );
}

export async function PUT(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const input = batchSiteConfigInput.parse(await readJson(request));
      const result = await getSiteConfigService().batchUpdate(input);
      revalidateSiteChrome();
      return result;
    },
    { request },
  );
}
