import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runMigrations } from "@/server/db/migrate";
import { openDatabase, type DatabaseConnection } from "@/server/db/open";
import * as schema from "@/server/db/schema";
import { verifyGithubToken } from "@/server/auth/session";
import { createGithubAuthService } from "./service";

let directory: string;
let connection: DatabaseConnection;
let db: BetterSQLite3Database<typeof schema>;
let login: string;
let fetchMock: ReturnType<typeof vi.fn>;

function jsonResponse(value: unknown): Response {
  return Response.json(value);
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "kirameku-github-auth-"));
  connection = openDatabase(path.join(directory, "test.db"));
  runMigrations(connection);
  db = drizzle(connection, { schema });
  login = "octocat";

  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("login/oauth/access_token")) {
      return jsonResponse({ access_token: "gho_test" });
    }
    if (url.includes("api.github.com/user")) {
      return jsonResponse({
        id: 12345,
        login,
        avatar_url: `https://avatars.example/${login}.png`,
        bio: `${login} bio`,
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
});

afterEach(() => {
  connection?.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

function service() {
  return createGithubAuthService(db, {
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri: "http://localhost:3000/api/auth/github/callback",
    frontendOrigin: "http://localhost:3000",
    fetch: fetchMock as typeof fetch,
  });
}

describe("github auth service", () => {
  it("builds the GitHub authorize URL with state and redirect URI", () => {
    const url = new URL(service().loginUrl("state-123"));

    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("scope")).toBe("read:user");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/github/callback",
    );
  });

  it("exchanges a code, upserts the GitHub user and signs a token", async () => {
    const result = await service().handleCallback("code-1");

    expect(result.user).toMatchObject({
      login: "octocat",
      avatar: "https://avatars.example/octocat.png",
      bio: "octocat bio",
    });
    expect(result.redirectUrl).toBe("http://localhost:3000/auth/callback");
    expect(result.redirectUrl).not.toContain("token");

    const token = result.token;
    expect(await verifyGithubToken(token)).toMatchObject({
      sub: String(result.user.id),
      aud: "github",
      login: "octocat",
    });
    expect(await service().me(token)).toEqual(result.user);

    login = "octocat-renamed";
    const second = await service().handleCallback("code-2");
    expect(second.user.id).toBe(result.user.id);
    expect(second.user.login).toBe("octocat-renamed");

    const count = connection
      .prepare('SELECT count(*) AS value FROM "github_user"')
      .get() as { value: number };
    expect(count.value).toBe(1);
  });

  it("reads a GitHub user from the session cookie and ignores bearer tokens", async () => {
    const result = await service().handleCallback("code-1");

    const request = new Request("http://localhost:3000/api/auth/github/me", {
      headers: { Cookie: `kir_gh=${encodeURIComponent(result.token)}` },
    });
    await expect(service().userFromRequest(request)).resolves.toMatchObject({
      id: result.user.id,
      login: "octocat",
    });

    const bearerOnly = new Request(
      "http://localhost:3000/api/auth/github/me",
      { headers: { Authorization: `Bearer ${result.token}` } },
    );
    await expect(service().userFromRequest(bearerOnly)).resolves.toBeNull();

    const invalid = new Request("http://localhost:3000/api/auth/github/me", {
      headers: { Cookie: "kir_gh=invalid" },
    });
    await expect(service().userFromRequest(invalid)).resolves.toBeNull();
  });

  it("rejects a failed token exchange", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error_description: "bad code" }),
    );

    await expect(service().handleCallback("bad-code")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "bad code",
    });
  });
});
