import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  bookmarkCategoryIdParams,
  updateBookmarkCategoryInput,
} from "@/server/modules/bookmarks/contracts";
import { getBookmarksService } from "@/server/modules/bookmarks";
import { revalidateBookmarks } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = bookmarkCategoryIdParams.parse(await params);
      const input = updateBookmarkCategoryInput.parse(await readJson(request));
      const result = await getBookmarksService().updateCategory(id, input);
      revalidateBookmarks();
      return result;
    },
    { request },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = bookmarkCategoryIdParams.parse(await params);
      const result = await getBookmarksService().removeCategory(id);
      revalidateBookmarks();
      return result;
    },
    { request },
  );
}
