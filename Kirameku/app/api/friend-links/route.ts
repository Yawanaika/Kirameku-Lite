import { handle } from "@/server/http/handler";
import { getFriendLinksService } from "@/server/modules/friend-links";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(() => getFriendLinksService().listApproved(), { request });
}
