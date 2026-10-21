import { handle } from "@/server/http/handler";
import { getCategoriesService } from "@/server/modules/categories";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(() => getCategoriesService().list(), { request });
}
