import { handle } from "@/server/http/handler";
import { getVisitorsService } from "@/server/modules/visitors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => ({ code: 0, count: await getVisitorsService().count() }),
    { request },
  );
}
