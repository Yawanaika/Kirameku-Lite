import { handle } from "@/server/http/handler";
import {
  NAV_DROPDOWN_CONFIG_KEY,
  parseNavDropdownConfig,
} from "@/lib/nav-dropdown";
import { getSiteConfigService } from "@/server/modules/site-config";

export const dynamic = "force-dynamic";

/**
 * 前台导航栏读取的自定义下拉菜单配置。
 *
 * 无论库里有没有这个键、值是否合法，都返回一份可用的配置（默认关闭），
 * 这样 Navbar 不需要处理 404 或异常分支。
 */
export async function GET(request: Request) {
  return handle(
    async () => {
      const config = await getSiteConfigService().getPublic();
      return parseNavDropdownConfig(config[NAV_DROPDOWN_CONFIG_KEY]);
    },
    { request },
  );
}
