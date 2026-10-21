import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import {
  adminProjectIdParams,
  updateProjectInput,
} from "@/server/modules/projects/contracts";
import { getProjectsService } from "@/server/modules/projects";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      await requireAdmin();
      const { id } = adminProjectIdParams.parse(await params);
      return getProjectsService().getById(id);
    },
    { request },
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(
    async () => {
      assertWritable();
      assertSameOrigin(request);
      await requireAdmin();
      const { id } = adminProjectIdParams.parse(await params);
      const input = updateProjectInput.parse(await readJson(request));
      return getProjectsService().update(id, input);
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
      const { id } = adminProjectIdParams.parse(await params);
      return getProjectsService().remove(id);
    },
    { request },
  );
}
