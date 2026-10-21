import { requireAdmin } from "@/server/auth/guard";
import { handle } from "@/server/http/handler";
import { adminPostCountQuery } from "@/server/modules/posts/contracts";
import { getPostsService } from "@/server/modules/posts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = adminPostCountQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return { count: await getPostsService().count(query.status) };
    },
    { request },
  );
}
