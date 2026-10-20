import { readJson } from "@/server/http/body";
import { AppError } from "@/server/http/errors";
import { handle } from "@/server/http/handler";
import { getClientIp } from "@/server/http/ip";
import { assertSameOrigin } from "@/server/http/origin";
import {
  assertRateLimit,
  recordRateLimitFailure,
} from "@/server/http/rate-limit";
import { adminCookie } from "@/server/auth/session";
import { loginInput } from "@/server/modules/auth/contracts";
import { authService } from "@/server/modules/auth/service";

export async function POST(request: Request) {
  return handle(
    async () => {
      assertSameOrigin(request);
      const rateLimitKey = `auth:login:${getClientIp(request)}`;
      assertRateLimit(rateLimitKey, 5, 60_000);

      const input = loginInput.parse(await readJson(request));
      let result: Awaited<ReturnType<typeof authService.login>>;
      try {
        result = await authService.login(input.username, input.password);
      } catch (error) {
        if (error instanceof AppError && error.code === "UNAUTHORIZED") {
          recordRateLimitFailure(rateLimitKey, 60_000);
        }
        throw error;
      }

      const response = Response.json({ user: result.user });
      response.headers.append("set-cookie", adminCookie(result.token));
      return response;
    },
    { request },
  );
}
