import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  adminPostListQuery,
  createPostInput,
} from "@/server/modules/posts/contracts";
import { getPostsService } from "@/server/modules/posts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = adminPostListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getPostsService().list(query);
    },
    { request },
  );
}

export async function POST(request: Request) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const input = createPostInput.parse(await readJson(request));
      return getPostsService().create(input);
    },
    { request },
  );
}
