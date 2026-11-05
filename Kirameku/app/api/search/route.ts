import { handle } from "@/server/http/handler";
import { enforceIpRateLimit } from "@/server/http/rate-limit";
import { searchQuery } from "@/server/modules/search/contracts";
import { getSearchService } from "@/server/modules/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      // 搜索是无索引扫描兜底 + LIKE，公开接口必须限流：每次 30 次 / 分钟。
      enforceIpRateLimit(request, "search", 30, 60_000);
      const query = searchQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getSearchService().search(query);
    },
    { request },
  );
}
