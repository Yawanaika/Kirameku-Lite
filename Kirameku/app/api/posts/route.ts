import { handle } from "@/server/http/handler";
import { getPostsService } from "@/server/modules/posts";
import { postListQuery } from "@/server/modules/posts/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      const query = postListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getPostsService().list(query);
    },
    { request },
  );
}
