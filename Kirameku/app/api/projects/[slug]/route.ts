import { handle } from "@/server/http/handler";
import { projectSlugParams } from "@/server/modules/projects/contracts";
import { getProjectsService } from "@/server/modules/projects";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return handle(
    async () => {
      const { slug } = projectSlugParams.parse(await params);
      return getProjectsService().getBySlug(slug);
    },
    { request },
  );
}
