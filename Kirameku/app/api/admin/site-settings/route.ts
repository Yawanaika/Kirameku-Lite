import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { siteSettingsInput } from "@/server/modules/site-settings/contracts";
import {
  loadSiteSettings,
  saveSiteSettings,
} from "@/server/modules/site-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      return loadSiteSettings();
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

      const input = siteSettingsInput.parse(await readJson(request));
      const settings = await saveSiteSettings(input);

      // 前台页面多为 ISR，配置落库后要让已缓存的布局重新渲染。
      try {
        revalidatePath("/", "layout");
      } catch {
        // 在非 Next 请求上下文（如单元测试）里调用会抛错，不影响保存结果。
      }

      return settings;
    },
    { request },
  );
}
