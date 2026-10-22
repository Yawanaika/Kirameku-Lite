import { eq } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/types";
import { githubUser } from "@/server/db/schema";
import { env } from "@/server/env";
import {
  GITHUB_TOKEN_COOKIE,
  signGithubToken,
  verifyGithubToken,
} from "@/server/auth/session";
import { readCookie } from "@/server/auth/cookies";
import { errors } from "@/server/http/errors";
import type { GithubPublicUser } from "./contracts";

type GithubUserRow = typeof githubUser.$inferSelect;

interface GithubProfile {
  id: number;
  login: string;
  avatar_url?: string | null;
  bio?: string | null;
}

export interface GithubAuthOptions {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  frontendOrigin?: string;
  fetch?: typeof fetch;
}

function toPublicUser(row: GithubUserRow): GithubPublicUser {
  return {
    id: row.id,
    login: row.login,
    avatar: row.avatar ?? "",
    bio: row.bio ?? "",
  };
}

export function createGithubAuthService(
  db: AppDatabase,
  options: GithubAuthOptions = {},
) {
  const clientId = options.clientId ?? env.GITHUB_CLIENT_ID ?? "";
  const clientSecret = options.clientSecret ?? env.GITHUB_CLIENT_SECRET ?? "";
  const frontendOrigin = (
    options.frontendOrigin ??
    env.FRONTEND_ORIGIN ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  const redirectUri =
    options.redirectUri ??
    env.GITHUB_REDIRECT_URI ??
    `${frontendOrigin}/api/auth/github/callback`;
  const fetchImpl = options.fetch ?? fetch;

  async function findById(id: number): Promise<GithubUserRow | null> {
    const [row] = await db
      .select()
      .from(githubUser)
      .where(eq(githubUser.id, id))
      .limit(1);
    return row ?? null;
  }

  async function userFromToken(token: string): Promise<GithubUserRow | null> {
    const claims = await verifyGithubToken(token);
    if (!claims) return null;

    const id = Number(claims.sub);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return findById(id);
  }

  return {
    loginUrl(state: string): string {
      if (!clientId) {
        throw errors.internal("未配置 GITHUB_CLIENT_ID");
      }

      const url = new URL("https://github.com/login/oauth/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("scope", "read:user");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      return url.toString();
    },

    async handleCallback(code: string): Promise<{
      token: string;
      user: GithubPublicUser;
      redirectUrl: string;
    }> {
      if (!clientId || !clientSecret) {
        throw errors.internal("GitHub OAuth 未配置");
      }

      const tokenResponse = await fetchImpl(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Kirameku",
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!tokenResponse.ok) {
        throw errors.badRequest("GitHub 授权失败");
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token?: unknown;
        error_description?: unknown;
      };
      if (typeof tokenData.access_token !== "string" || !tokenData.access_token) {
        const detail =
          typeof tokenData.error_description === "string"
            ? tokenData.error_description
            : "GitHub 授权失败";
        throw errors.badRequest(detail);
      }

      const userResponse = await fetchImpl("https://api.github.com/user", {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "Kirameku",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!userResponse.ok) {
        throw errors.badRequest("获取 GitHub 用户信息失败");
      }

      const profile = (await userResponse.json()) as Partial<GithubProfile>;
      if (
        !Number.isSafeInteger(profile.id) ||
        typeof profile.login !== "string" ||
        !profile.login
      ) {
        throw errors.badRequest("GitHub 用户信息不完整");
      }

      const [row] = await db
        .insert(githubUser)
        .values({
          githubId: profile.id as number,
          login: profile.login,
          avatar: profile.avatar_url ?? "",
          bio: profile.bio ?? "",
        })
        .onConflictDoUpdate({
          target: githubUser.githubId,
          set: {
            login: profile.login,
            avatar: profile.avatar_url ?? "",
            bio: profile.bio ?? "",
          },
        })
        .returning();

      if (!row) throw errors.internal("保存 GitHub 用户失败");

      const token = await signGithubToken(row.id, row.login);
      return {
        token,
        user: toPublicUser(row),
        redirectUrl: `${frontendOrigin}/auth/callback`,
      };
    },

    async me(token: string): Promise<GithubPublicUser> {
      const row = await userFromToken(token);
      if (!row) throw errors.unauthorized("登录已过期，请重新登录");
      return toPublicUser(row);
    },

    async userFromRequest(request: Request): Promise<GithubUserRow | null> {
      const token = readCookie(request, GITHUB_TOKEN_COOKIE);
      if (!token) return null;
      return userFromToken(token);
    },
  };
}

export type GithubAuthService = ReturnType<typeof createGithubAuthService>;
