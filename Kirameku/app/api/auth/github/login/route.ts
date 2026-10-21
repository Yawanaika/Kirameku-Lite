import crypto from "node:crypto";
import { handle } from "@/server/http/handler";
import { githubStateCookie } from "@/server/auth/oauth-state";
import { getGithubAuthService } from "@/server/modules/github-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(
    async () => {
      const state = crypto.randomBytes(16).toString("hex");
      const location = getGithubAuthService().loginUrl(state);
      return new Response(null, {
        status: 302,
        headers: {
          Location: location,
          "Set-Cookie": githubStateCookie(state),
          "Cache-Control": "no-store",
        },
      });
    },
    { request },
  );
}
