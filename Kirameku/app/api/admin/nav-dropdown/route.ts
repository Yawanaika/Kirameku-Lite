import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  NAV_DROPDOWN_CONFIG_KEY,
  parseNavDropdownConfig,
} from "@/lib/nav-dropdown";
import { navDropdownConfigInput } from "@/server/modules/site-config/contracts";
import { getSiteConfigService } from "@/server/modules/site-config";

export const dynamic = "force-dynamic";

const DESCRIPTION = "首页导航栏自定义下拉菜单（JSON）";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const config = await getSiteConfigService().getPublic();
      return parseNavDropdownConfig(config[NAV_DROPDOWN_CONFIG_KEY]);
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

      const input = navDropdownConfigInput.parse(await readJson(request));
      const config = parseNavDropdownConfig(input);
      await getSiteConfigService().update(NAV_DROPDOWN_CONFIG_KEY, {
        value: JSON.stringify(config),
        description: DESCRIPTION,
      });
      return config;
    },
    { request },
  );
}
