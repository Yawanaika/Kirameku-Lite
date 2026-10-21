import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  bookmarkSiteListQuery,
  createBookmarkSiteInput,
} from "@/server/modules/bookmarks/contracts";
import { getBookmarksService } from "@/server/modules/bookmarks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      const query = bookmarkSiteListQuery.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );
      return getBookmarksService().listSites(query.category_id);
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
      const input = createBookmarkSiteInput.parse(await readJson(request));
      return getBookmarksService().createSite(input);
    },
    { request },
  );
}
