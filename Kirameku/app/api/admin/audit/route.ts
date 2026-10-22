import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { auditListQuery } from "@/server/modules/audit/contracts";
import { getAuditService } from "@/server/modules/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const { searchParams } = new URL(request.url);
      const params = auditListQuery.parse(Object.fromEntries(searchParams));
      return getAuditService().list(params);
    },
    { request },
  );
}
