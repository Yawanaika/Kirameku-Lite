import { requireAdmin } from "@/server/auth/guard";
import { readJson } from "@/server/http/body";
import { handle } from "@/server/http/handler";
import { getClientIp } from "@/server/http/ip";
import { assertSameOrigin } from "@/server/http/origin";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { assertWritable } from "@/server/http/write-guard";
import { changePasswordInput } from "@/server/modules/auth/contracts";
import { authService } from "@/server/modules/auth/service";

export async function POST(request: Request) {
  return handle(
    async () => {
      assertSameOrigin(request);
      assertWritable();
      const admin = await requireAdmin();
      enforceRateLimit(
        `auth:change-password:${admin.id}:${getClientIp(request)}`,
        5,
        10 * 60_000,
      );
      const input = changePasswordInput.parse(await readJson(request));
      return authService.changePassword(
        admin.id,
        input.currentPassword,
        input.newPassword,
      );
    },
    { request },
  );
}
