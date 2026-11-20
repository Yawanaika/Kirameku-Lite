import { describe, expect, it } from "vitest";
import { decryptImagebedToken, encryptImagebedToken } from "./secrets";

describe("imagebed token encryption", () => {
  it("encrypts tokens with an authenticated ciphertext and round-trips", () => {
    const encrypted = encryptImagebedToken("my private token");
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("my private token");
    expect(decryptImagebedToken(encrypted)).toBe("my private token");
  });

  it("uses fresh nonces and rejects tampering or plaintext", () => {
    const first = encryptImagebedToken("token");
    const second = encryptImagebedToken("token");
    expect(first).not.toBe(second);
    const [prefix, version, payload] = first.split(":");
    const parts = payload.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptImagebedToken([prefix, version, parts.join(".")].join(":"))).toThrow();
    expect(() => decryptImagebedToken("plaintext-token")).toThrow();
  });
});
