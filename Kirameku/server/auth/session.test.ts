import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { getAuthSecret } from "@/server/env";
import { signAdminToken, verifyAdminToken } from "./session";

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
