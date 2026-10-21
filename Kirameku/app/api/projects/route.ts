import { handle } from "@/server/http/handler";
import { getProjectsService } from "@/server/modules/projects";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => getProjectsService().list(),
    { request },
  );
}
