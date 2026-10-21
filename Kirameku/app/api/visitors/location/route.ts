import { handle } from "@/server/http/handler";
import { getClientIp } from "@/server/http/ip";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { getVisitorsService } from "@/server/modules/visitors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      const ip = getClientIp(request);
      enforceRateLimit(`visitors:location:${ip}`, 60, 60_000);
      return { code: 0, data: await getVisitorsService().location(ip) };
    },
    { request },
  );
}
