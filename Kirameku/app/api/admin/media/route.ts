import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { mediaListQuery } from "@/server/modules/media/contracts";
import { getMediaService } from "@/server/modules/media";

export const dynamic = "force-dynamic";

/**
 * 媒体库只读接口。删除照片仍然走 /api/admin/albums/photos/[id]，
 * 这里不再开一套写入口，免得两处都要维护计数与缓存失效。
 */
export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = mediaListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getMediaService().overview(query);
    },
    { request },
  );
}
