import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { imagebedSettingsInput } from "@/server/modules/imagebed/contracts";
import { getImagebedSettings, saveImagebedSettings } from "@/server/modules/imagebed";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      return getImagebedSettings();
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
      const input = imagebedSettingsInput.parse(await readJson(request));
      return saveImagebedSettings(input);
    },
    { request },
  );
}
