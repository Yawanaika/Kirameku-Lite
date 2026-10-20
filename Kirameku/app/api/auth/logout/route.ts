import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";
import { clearAdminCookie } from "@/server/auth/session";

export async function POST(request: Request) {
  return handle(
    async () => {
      assertSameOrigin(request);
      const response = Response.json({ ok: true });
      response.headers.append("set-cookie", clearAdminCookie());
      return response;
    },
    { request },
  );
}
