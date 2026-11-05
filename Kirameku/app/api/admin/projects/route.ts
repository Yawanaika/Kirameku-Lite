import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { createProjectInput } from "@/server/modules/projects/contracts";
import { getProjectsService } from "@/server/modules/projects";
import { revalidateProjects } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      await requireAdmin();
      return getProjectsService().list();
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
      const input = createProjectInput.parse(await readJson(request));
      const result = await getProjectsService().create(input);
      revalidateProjects();
      return result;
    },
    { request },
  );
}
