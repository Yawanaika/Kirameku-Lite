import { beforeEach, describe, expect, it, vi } from "vitest";
import { GITHUB_STATE_COOKIE } from "@/server/auth/constants";

const { handleCallback } = vi.hoisted(() => ({
  handleCallback: vi.fn(),
}));

vi.mock("@/server/modules/github-auth", () => ({
  getGithubAuthService: () => ({ handleCallback }),
}));

import { GET } from "./route";

function callbackRequest(
  query: string,
  cookies: Record<string, string> = {},
): Request {
  const cookie = Object.entries(cookies)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("; ");
  return new Request(
    `http://localhost:3000/api/auth/github/callback?${query}`,
    { headers: cookie ? { cookie } : undefined },
  );
}

beforeEach(() => {
  handleCallback.mockReset();
});

describe("GET /api/auth/github/callback", () => {
  it("sets the session cookie and keeps the token out of the redirect URL", async () => {
    handleCallback.mockResolvedValue({
      token: "signed-token",
      user: { id: 1, login: "octocat", avatar: "", bio: "" },
      redirectUrl: "http://localhost:3000/auth/callback",
    });

    const response = await GET(
      callbackRequest("code=code-1&state=state-1", {
        [GITHUB_STATE_COOKIE]: "state-1",
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/callback",
    );
    expect(response.headers.get("location")).not.toContain("token");

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("kir_gh=signed-token");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Max-Age=");
    expect(setCookie).toContain("kir_gh_state=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("rejects a mismatched state without exchanging the code", async () => {
    const response = await GET(
      callbackRequest("code=code-1&state=state-2", {
        [GITHUB_STATE_COOKIE]: "state-1",
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(handleCallback).not.toHaveBeenCalled();
  });

  it("rejects a cancelled authorization", async () => {
    const response = await GET(callbackRequest("error=access_denied"));

    expect(response.status).toBe(400);
    expect(handleCallback).not.toHaveBeenCalled();
  });
});
