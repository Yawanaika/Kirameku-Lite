import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(
      true,
    );
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("returns false for an invalid hash instead of throwing", async () => {
    expect(await verifyPassword("anything", "not-a-bcrypt-hash")).toBe(false);
  });

  it("rejects passwords longer than the bcrypt 72-byte limit", async () => {
    await expect(hashPassword("a".repeat(73))).rejects.toThrow();
    expect(await verifyPassword("a".repeat(73), "not-a-bcrypt-hash")).toBe(
      false,
    );
  });
});
