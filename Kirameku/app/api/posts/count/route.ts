import { handle } from "@/server/http/handler";
import { getPostsService } from "@/server/modules/posts";
import { postCountQuery } from "@/server/modules/posts/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      const query = postCountQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return { count: await getPostsService().count(query.status) };
    },
    { request },
  );
}
