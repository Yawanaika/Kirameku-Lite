import { describe, expect, it } from "vitest";
import { AppError } from "@/server/http/errors";
import {
  buildOssCanonicalString,
  buildOssPublicUrl,
  normalizeOssPrefix,
  putOssObject,
  signOssRequest,
  type OssConfig,
} from "./oss";

const config: OssConfig = {
  accessKeyId: "test-key",
  accessKeySecret: "test-secret",
  bucket: "kirameku-bucket",
  endpoint: "oss-cn-beijing.aliyuncs.com",
  prefix: "Boke",
};

describe("OSS upload helper", () => {
  it("normalizes prefixes", () => {
    expect(normalizeOssPrefix("/Boke/images/")).toBe("Boke/images");
    expect(normalizeOssPrefix(undefined)).toBe("");
  });

  it("builds canonical strings and signatures", () => {
    const input = {
      bucket: "kirameku-bucket",
      key: "Boke/2026/10/a.png",
      contentType: "image/png",
      date: "Wed, 21 Oct 2015 07:28:00 GMT",
    };
    expect(buildOssCanonicalString(input)).toBe(
      [
        "PUT",
        "",
        "image/png",
        "Wed, 21 Oct 2015 07:28:00 GMT",
        "/kirameku-bucket/Boke/2026/10/a.png",
      ].join("\n"),
    );

    const signature = signOssRequest({
      ...input,
      accessKeySecret: "test-secret",
    });
    expect(signature).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(
      signOssRequest({ ...input, accessKeySecret: "another-secret" }),
    ).not.toBe(signature);
  });

  it("builds public URLs with the configured domain", () => {
    expect(buildOssPublicUrl(config, "Boke/2026/10/a b.png")).toBe(
      "https://kirameku-bucket.oss-cn-beijing.aliyuncs.com/Boke/2026/10/a%20b.png",
    );
    expect(
      buildOssPublicUrl(config, "Boke/2026/10/a.png", "https://static.example.com/"),
    ).toBe("https://static.example.com/Boke/2026/10/a.png");
  });

  it("sends a signed PUT request and surfaces upstream errors", async () => {
    const captured: { url: string; init?: RequestInit }[] = [];
    await putOssObject(
      config,
      "Boke/2026/10/a.png",
      Buffer.from("data"),
      "image/png",
      async (url, init) => {
        captured.push({ url: String(url), init });
        return new Response(null, { status: 200 });
      },
    );

    expect(captured[0]?.url).toBe(
      "https://kirameku-bucket.oss-cn-beijing.aliyuncs.com/Boke/2026/10/a.png",
    );
    const headers = new Headers(captured[0]?.init?.headers);
    expect(headers.get("Authorization")).toMatch(
      /^OSS test-key:[A-Za-z0-9+/]+={0,2}$/,
    );
    expect(headers.get("Content-Type")).toBe("image/png");
    expect(headers.get("Date")).toBeTruthy();

    await expect(
      putOssObject(
        config,
        "Boke/2026/10/b.png",
        Buffer.from("data"),
        "image/png",
        async () => new Response("denied", { status: 403 }),
      ),
    ).rejects.toThrow(AppError);
  });
});
