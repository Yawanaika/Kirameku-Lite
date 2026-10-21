import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { visitorListQuery } from "@/server/modules/visitors/contracts";
import { getVisitorsService } from "@/server/modules/visitors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = visitorListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getVisitorsService().list(query);
    },
    { request },
  );
}

export async function DELETE(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      return getVisitorsService().clear();
    },
    { request },
  );
}
