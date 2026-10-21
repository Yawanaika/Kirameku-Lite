import { handle } from "@/server/http/handler";
import { getPostsService } from "@/server/modules/posts";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return handle(
    async () => {
      const { slug } = await params;
      return getPostsService().getBySlug(slug, { publishedOnly: true });
    },
    { request },
  );
}
