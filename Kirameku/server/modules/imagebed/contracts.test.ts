import { describe, expect, it } from "vitest";
import { imagebedSettingsInput, normalizeImagebedBaseUrl } from "./contracts";


describe("imagebed settings contracts", () => {
  it("normalizes trailing slashes and accepts a safe optional upload folder", () => {
    expect(normalizeImagebedBaseUrl(" https://images.example.test/service/// ")).toBe("https://images.example.test/service");
    expect(imagebedSettingsInput.parse({
      enabled: true,
      baseUrl: "https://images.example.test",
      apiToken: "token",
      uploadFolder: "blog/2026-images",
    })).toMatchObject({ enabled: true, uploadFolder: "blog/2026-images", clearApiToken: false });
  });

  it("rejects credentials, query strings, local destinations, upload paths and unsafe folders", () => {
    for (const baseUrl of [
      "https://user:pass@images.example.test",
      "https://images.example.test?token=x",
      "http://localhost:8080",
      "https://service.local",
      "https://images.example.test/upload",
    ]) {
      expect(() => imagebedSettingsInput.parse({ baseUrl })).toThrow();
    }
    expect(() => imagebedSettingsInput.parse({ uploadFolder: "../private" })).toThrow();
    expect(() => imagebedSettingsInput.parse({ uploadFolder: "nested//bad" })).toThrow();
  });
});
