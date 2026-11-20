import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/http/errors";
import { assertPublicImagebedTarget, isPublicIp, uploadToImagebed } from "./client";
import type { ImagebedRuntimeConfig } from "./contracts";
import type { ImagebedUploadRequest } from "./client";

const config: ImagebedRuntimeConfig = {
  baseUrl: "https://images.example.test/service",
  apiToken: "secret-token",
  uploadFolder: "blog/images",
};

const publicTarget = async (baseUrl: string) => ({
  baseUrl,
  addresses: [{ address: "8.8.8.8", family: 4 as const }],
});

function makeRequest(payload: unknown, status = 200) {
  return vi.fn(async (_request: ImagebedUploadRequest) => ({ status, body: JSON.stringify(payload) }));
}

describe("imagebed upload client", () => {
  it("builds a fixed Telegram multipart request and returns the public URL/path", async () => {
    const requestImpl = makeRequest({ data: { src: "/file/2026/11/photo.webp" } });
    const result = await uploadToImagebed(
      config,
      { key: "2026/11/random.webp", buffer: Buffer.from("image-bytes"), contentType: "image/webp" },
      requestImpl,
      publicTarget,
    );

    expect(result).toEqual({
      url: "https://images.example.test/file/2026/11/photo.webp",
      remotePath: "2026/11/photo.webp",
    });
    const request = requestImpl.mock.calls[0][0];
    expect(request.endpoint.pathname).toBe("/service/upload");
    expect(request.endpoint.searchParams.get("uploadChannel")).toBe("telegram");
    expect(request.endpoint.searchParams.get("returnFormat")).toBe("full");
    expect(request.endpoint.searchParams.get("responseFormat")).toBe("object");
    expect(request.token).toBe("secret-token");
    expect(request.folder).toBe("blog/images");
    expect(request.input.contentType).toBe("image/webp");
    expect(request.target.addresses[0].address).toBe("8.8.8.8");
  });

  it("uses publicUrl when returned and supports a top-level array response", async () => {
    const requestImpl = makeRequest([{ src: "/file/id.png", publicUrl: "https://cdn.example.test/id.png" }]);
    const result = await uploadToImagebed(
      { ...config, uploadFolder: "" },
      { key: "id.png", buffer: Buffer.from("x"), contentType: "image/png" },
      requestImpl,
      publicTarget,
    );
    expect(result).toEqual({ url: "https://cdn.example.test/id.png", remotePath: "id.png" });
    expect(requestImpl.mock.calls[0][0].folder).toBe("");
  });

  it("maps upstream authentication failures without leaking response text", async () => {
    const requestImpl = makeRequest({ secret: "response-body" }, 401);
    await expect(uploadToImagebed(
      config,
      { key: "a.png", buffer: Buffer.from("x"), contentType: "image/png" },
      requestImpl,
      publicTarget,
    )).rejects.toThrow("图床认证失败，请检查 API Token");
  });

  it("rejects malformed success payloads and unsafe image URLs", async () => {
    const badPayload = makeRequest({ src: "javascript:alert(1)" });
    await expect(uploadToImagebed(
      config,
      { key: "a.png", buffer: Buffer.from("x"), contentType: "image/png" },
      badPayload,
      publicTarget,
    )).rejects.toThrow(AppError);

    const malformed = makeRequest({ message: "ok" });
    await expect(uploadToImagebed(
      config,
      { key: "a.png", buffer: Buffer.from("x"), contentType: "image/png" },
      malformed,
      publicTarget,
    )).rejects.toThrow("图床响应缺少图片地址");
  });

  it("blocks private and special-use IPv4/IPv6 targets", async () => {
    for (const address of ["127.0.0.1", "10.2.3.4", "172.20.0.1", "192.168.1.1", "169.254.169.254", "192.0.2.1", "224.0.0.1", "::1", "fc00::1", "fe80::1", "2001:0::1", "2001:1::1", "2001:3::1", "2001:db8::1", "3fff::1", "::ffff:127.0.0.1", "2002:7f00:1::1"]) {
      expect(isPublicIp(address), address).toBe(false);
    }
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("2001:4860:4860::8888")).toBe(true);
    await expect(assertPublicImagebedTarget("http://127.0.0.1:8080")).rejects.toThrow(AppError);
  });

  it.each([
    [403, "图床认证失败，请检查 API Token"],
    [413, "图床拒绝了该图片"],
    [429, "图床请求过于频繁，请稍后重试"],
    [503, "图床服务暂时不可用"],
  ])("maps upstream status %i to a safe error", async (status, message) => {
    const requestImpl = makeRequest({ secret: "must-not-leak" }, status);
    await expect(uploadToImagebed(
      config,
      { key: "a.png", buffer: Buffer.from("x"), contentType: "image/png" },
      requestImpl,
      publicTarget,
    )).rejects.toThrow(message);
  });

  it("maps network failures and invalid JSON to sanitized errors", async () => {
    const networkFailure = vi.fn().mockRejectedValue(new Error("token=must-not-leak"));
    await expect(uploadToImagebed(
      config,
      { key: "a.png", buffer: Buffer.from("x"), contentType: "image/png" },
      networkFailure,
      publicTarget,
    )).rejects.toThrow("无法连接图床或请求超时");

    const invalidJson = vi.fn(async () => ({ status: 200, body: "not-json" }));
    await expect(uploadToImagebed(
      config,
      { key: "a.png", buffer: Buffer.from("x"), contentType: "image/png" },
      invalidJson,
      publicTarget,
    )).rejects.toThrow("图床返回了无效响应");
  });
});
