import { getAdminSession, requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { errors } from "@/server/http/errors";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { assertWritable } from "@/server/http/write-guard";
import { profileInput } from "@/server/modules/auth/contracts";
import { authService } from "@/server/modules/auth/service";

export async function GET(request: Request) {
  return handle(
    async () => {
      const admin = await getAdminSession();
      if (!admin) throw errors.unauthorized();
      return { user: await authService.profile(admin.id) };
    },
    { request },
  );
}

export async function PUT(request: Request) {
  return handle(
    async () => {
      assertSameOrigin(request);
      assertWritable();
      const admin = await requireAdmin();
      const input = profileInput.parse(await readJson(request));
      return { user: await authService.updateProfile(admin.id, input) };
    },
    { request },
  );
}
