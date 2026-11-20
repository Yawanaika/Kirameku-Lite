import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getImagebedRuntimeConfig: vi.fn(),
  uploadToImagebed: vi.fn(),
  getOssConfig: vi.fn(),
  putOssObject: vi.fn(),
  buildOssPublicUrl: vi.fn(),
  writeLocalImage: vi.fn(),
}));

vi.mock("@/server/modules/imagebed", () => ({
  getImagebedRuntimeConfig: mocks.getImagebedRuntimeConfig,
}));
vi.mock("@/server/modules/imagebed/client", () => ({
  uploadToImagebed: mocks.uploadToImagebed,
}));
vi.mock("./oss", () => ({
  getOssConfig: mocks.getOssConfig,
  putOssObject: mocks.putOssObject,
  buildOssPublicUrl: mocks.buildOssPublicUrl,
}));
vi.mock("./local", () => ({
  buildUploadKey: vi.fn(() => "2026/11/test-image.png"),
  writeLocalImage: mocks.writeLocalImage,
}));

import { storeImageFile } from "./index";

function png(): Buffer {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(2, 16);
  buffer.writeUInt32BE(2, 20);
  buffer[24] = 8;
  buffer[25] = 6;
  return buffer;
}

function imageFile(): File {
  return new File([new Uint8Array(png())], "photo.png", { type: "image/png" });
}

const runtimeConfig = {
  baseUrl: "https://images.example.test",
  apiToken: "token",
  uploadFolder: "blog",
};

describe("storeImageFile imagebed selection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getOssConfig.mockReturnValue(null);
  });

  it("uses ImgBed when enabled and reports the remote path", async () => {
    mocks.getImagebedRuntimeConfig.mockResolvedValue(runtimeConfig);
    mocks.uploadToImagebed.mockResolvedValue({
      url: "https://images.example.test/file/photo.png",
      remotePath: "photo.png",
    });

    const result = await storeImageFile(imageFile());

    expect(result).toMatchObject({
      url: "https://images.example.test/file/photo.png",
      key: "photo.png",
      storage: "imagebed",
      width: 2,
      height: 2,
      format: "png",
      size: 33,
    });
    expect(mocks.uploadToImagebed).toHaveBeenCalledWith(runtimeConfig, expect.objectContaining({
      key: "2026/11/test-image.png",
      contentType: "image/png",
      buffer: expect.any(Buffer),
    }));
    expect(mocks.writeLocalImage).not.toHaveBeenCalled();
  });

  it("does not silently fall back to OSS or local storage when ImgBed fails", async () => {
    mocks.getImagebedRuntimeConfig.mockResolvedValue(runtimeConfig);
    mocks.uploadToImagebed.mockRejectedValue(new Error("upstream failure"));

    await expect(storeImageFile(imageFile())).rejects.toThrow("upstream failure");
    expect(mocks.putOssObject).not.toHaveBeenCalled();
    expect(mocks.writeLocalImage).not.toHaveBeenCalled();
  });

  it("preserves local storage behavior when ImgBed is disabled", async () => {
    mocks.getImagebedRuntimeConfig.mockResolvedValue(null);

    const result = await storeImageFile(imageFile());

    expect(result).toMatchObject({
      url: "/uploads/2026/11/test-image.png",
      key: "2026/11/test-image.png",
      storage: "local",
    });
    expect(mocks.uploadToImagebed).not.toHaveBeenCalled();
    expect(mocks.writeLocalImage).toHaveBeenCalledOnce();
  });

  it("preserves OSS storage behavior when ImgBed is disabled", async () => {
    const oss = {
      accessKeyId: "access-key",
      accessKeySecret: "secret",
      bucket: "kirameku",
      endpoint: "oss.example.test",
      prefix: "images",
    };
    mocks.getImagebedRuntimeConfig.mockResolvedValue(null);
    mocks.getOssConfig.mockReturnValue(oss);
    mocks.buildOssPublicUrl.mockReturnValue("https://cdn.example.test/images/test-image.png");

    const result = await storeImageFile(imageFile());

    expect(result).toMatchObject({
      url: "https://cdn.example.test/images/test-image.png",
      key: "images/2026/11/test-image.png",
      storage: "oss",
    });
    expect(mocks.putOssObject).toHaveBeenCalledWith(
      oss,
      "images/2026/11/test-image.png",
      expect.any(Buffer),
      "image/png",
    );
    expect(mocks.writeLocalImage).not.toHaveBeenCalled();
  });
});
