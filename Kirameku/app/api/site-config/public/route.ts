import { handle } from "@/server/http/handler";
import { getSiteConfigService } from "@/server/modules/site-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(() => getSiteConfigService().getPublic(), { request });
}
