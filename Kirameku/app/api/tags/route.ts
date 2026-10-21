import { handle } from "@/server/http/handler";
import { getTagsService } from "@/server/modules/tags";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(() => getTagsService().list(), { request });
}
