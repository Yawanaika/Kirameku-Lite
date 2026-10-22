import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { getAuthSecret } from "@/server/env";
import {
  GITHUB_TOKEN_TTL_SECONDS,
  clearGithubCookie,
  githubCookie,
  signAdminToken,
  signGithubToken,
  verifyAdminToken,
  verifyGithubToken,
} from "./session";

describe("admin session", () => {
  it("signs and verifies an admin token", async () => {
    const token = await signAdminToken(42);
    const claims = await verifyAdminToken(token);
    expect(claims).toEqual({
      sub: "42",
      aud: "admin",
      role: "admin",
      ver: 1,
    });
  });

  it("rejects a token with a different audience", async () => {
    const token = await new SignJWT({ role: "admin", ver: 1 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("42")
      .setAudience("github")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(getAuthSecret());

    expect(await verifyAdminToken(token)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signAdminToken(42);
    const [header, payload, signature] = token.split(".");
    const tamperedSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
    expect(
      await verifyAdminToken(`${header}.${payload}.${tamperedSignature}`),
    ).toBeNull();
  });
});

describe("github session", () => {
  it("signs and verifies a github token", async () => {
    const token = await signGithubToken(7, "octocat");
    expect(await verifyGithubToken(token)).toEqual({
      sub: "7",
      aud: "github",
      login: "octocat",
      ver: 1,
    });
  });

  it("keeps admin and github audiences separate", async () => {
    const adminToken = await signAdminToken(42);
    const githubToken = await signGithubToken(7, "octocat");

    expect(await verifyGithubToken(adminToken)).toBeNull();
    expect(await verifyAdminToken(githubToken)).toBeNull();
  });

  it("stores the github token in an httpOnly cookie", () => {
    const cookie = githubCookie("token-value");

    expect(cookie).toContain("kir_gh=token-value");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain(`Max-Age=${GITHUB_TOKEN_TTL_SECONDS}`);
  });

  it("clears the github cookie with Max-Age=0", () => {
    const cookie = clearGithubCookie();

    expect(cookie).toContain("kir_gh=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
  });
});
