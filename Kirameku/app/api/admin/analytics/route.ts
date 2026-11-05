import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { analyticsQuery } from "@/server/modules/analytics/contracts";
import { getAnalyticsService } from "@/server/modules/analytics";

export const dynamic = "force-dynamic";

/**
 * 只读聚合：直接扫访客明细表，不写任何东西。
 * 所以这里不调 assertWritable()，只要求管理员身份。
 */
export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = analyticsQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getAnalyticsService().overview(query.days);
    },
    { request },
  );
}
