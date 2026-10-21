import { handle } from "@/server/http/handler";
import { getAlbumsService } from "@/server/modules/albums";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(() => getAlbumsService().list(), { request });
}
