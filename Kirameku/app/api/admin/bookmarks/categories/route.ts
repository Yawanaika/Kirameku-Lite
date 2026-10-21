import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { createBookmarkCategoryInput } from "@/server/modules/bookmarks/contracts";
import { getBookmarksService } from "@/server/modules/bookmarks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      return getBookmarksService().listCategories();
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
      const input = createBookmarkCategoryInput.parse(await readJson(request));
      return getBookmarksService().createCategory(input);
    },
    { request },
  );
}
