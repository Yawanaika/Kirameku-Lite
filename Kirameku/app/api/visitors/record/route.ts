import { handle } from "@/server/http/handler";
import { getClientIp } from "@/server/http/ip";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { getVisitorsService } from "@/server/modules/visitors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);

      const ip = getClientIp(request);
      enforceRateLimit(`visitors:record:${ip}`, 10, 60_000);

      await getVisitorsService().record({
        ip,
        path: request.headers.get("x-path") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      });

      return { code: 0, message: "ok" };
    },
    { request },
  );
}
