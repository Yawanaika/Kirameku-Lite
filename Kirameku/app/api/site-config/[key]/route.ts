import { errors } from "@/server/http/errors";
import { handle } from "@/server/http/handler";
import { siteConfigKeyParams } from "@/server/modules/site-config/contracts";
import { getSiteConfigService } from "@/server/modules/site-config";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  return handle(
    async () => {
      const { key } = siteConfigKeyParams.parse(await params);
      const config = await getSiteConfigService().getPublic();
      if (!(key in config)) {
        throw errors.notFound(`配置 ${key} 不存在`);
      }
      return config[key];
    },
    { request },
  );
}
