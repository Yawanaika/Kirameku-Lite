import { handle } from "@/server/http/handler";
import { loadSiteSettings } from "@/server/modules/site-settings";

export const dynamic = "force-dynamic";

/**
 * 公开的站点配置。
 *
 * 前台页面由服务端直接注入配置（见 app/(site)/layout.tsx），这个接口留给
 * 需要在客户端刷新配置或做外部集成的场景。永远返回一份完整配置。
 */
export async function GET(request: Request) {
  return handle(() => loadSiteSettings(), { request });
}
