import { handle } from "@/server/http/handler";
import { getBookmarksService } from "@/server/modules/bookmarks";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(() => getBookmarksService().list(), { request });
}
