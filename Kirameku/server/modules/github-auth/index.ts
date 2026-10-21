import { getDb } from "@/server/db/client";
import { env } from "@/server/env";
import { errors } from "@/server/http/errors";
import { createGithubAuthService } from "./service";

export function getGithubAuthService() {
  return createGithubAuthService(getDb(), {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    redirectUri: env.GITHUB_REDIRECT_URI,
    frontendOrigin: env.FRONTEND_ORIGIN,
  });
}

export async function requireGithubUser(request: Request) {
  const user = await getGithubAuthService().userFromRequest(request);
  if (!user) throw errors.unauthorized("请先登录 GitHub");
  return user;
}

export { createGithubAuthService } from "./service";
export type {
  GithubAuthOptions,
  GithubAuthService,
} from "./service";
export type { GithubPublicUser } from "./contracts";
