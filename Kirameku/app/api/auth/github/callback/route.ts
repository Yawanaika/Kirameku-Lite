import crypto from "node:crypto";
import { handle } from "@/server/http/handler";
import { errors } from "@/server/http/errors";
import {
  clearGithubStateCookie,
  readGithubStateCookie,
} from "@/server/auth/oauth-state";
import { githubCallbackQuery } from "@/server/modules/github-auth/contracts";
import { getGithubAuthService } from "@/server/modules/github-auth";
import { githubCookie } from "@/server/auth/session";

export const dynamic = "force-dynamic";

function statesMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  return handle(
    async () => {
      const url = new URL(request.url);
      if (url.searchParams.has("error")) {
        throw errors.badRequest("GitHub 授权已取消");
      }

      const query = githubCallbackQuery.parse(
        Object.fromEntries(url.searchParams),
      );
      const expectedState = readGithubStateCookie(request);
      if (!expectedState || !statesMatch(expectedState, query.state)) {
        throw errors.badRequest("登录状态已失效，请重新登录");
      }

      const result = await getGithubAuthService().handleCallback(query.code);
      const headers = new Headers();
      headers.append("Set-Cookie", clearGithubStateCookie());
      headers.append("Set-Cookie", githubCookie(result.token));
      headers.set("Location", result.redirectUrl);
      headers.set("Cache-Control", "no-store");
      return new Response(null, { status: 302, headers });
    },
    { request },
  );
}
