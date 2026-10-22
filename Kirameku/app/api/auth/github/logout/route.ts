import { clearGithubCookie } from "@/server/auth/session";
import { handle } from "@/server/http/handler";
import { assertSameOrigin } from "@/server/http/origin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(
    async () => {
      assertSameOrigin(request);
      const response = Response.json({ ok: true });
      response.headers.append("set-cookie", clearGithubCookie());
      return response;
    },
    { request },
  );
}
