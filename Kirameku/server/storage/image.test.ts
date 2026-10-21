import { describe, expect, it } from "vitest";
import { AppError } from "@/server/http/errors";
import { inspectImage, MAX_IMAGE_BYTES } from "./image";

function png(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = 6;
  return buffer;
}

function gif(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(13);
  buffer.write("GIF89a", 0, "ascii");
  buffer.writeUInt16LE(width, 6);
  buffer.writeUInt16LE(height, 8);
  return buffer;
}

function jpeg(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(21);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xc0;
  buffer.writeUInt16BE(17, 4);
  buffer[6] = 8;
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  buffer[11] = 3;
  return buffer;
}

function webp(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

describe("inspectImage", () => {
  it("reads PNG dimensions and orientation", () => {
    const info = inspectImage(png(800, 600), "image/png");
    expect(info).toMatchObject({
      format: "png",
      ext: "png",
      width: 800,
      height: 600,
      orientation: "landscape",
    });
  });

  it("reads GIF dimensions and portrait orientation", () => {
    const info = inspectImage(gif(320, 480), "image/gif");
    expect(info).toMatchObject({
      format: "gif",
      width: 320,
      height: 480,
      orientation: "portrait",
    });
  });

  it("reads JPEG dimensions", () => {
    const info = inspectImage(jpeg(200, 100), "image/jpeg");
    expect(info).toMatchObject({ format: "jpeg", width: 200, height: 100 });
  });

  it("reads WebP VP8X dimensions", () => {
    const info = inspectImage(webp(640, 480), "image/webp");
    expect(info).toMatchObject({ format: "webp", width: 640, height: 480 });
  });

  it("detects the real format instead of trusting the declared type", () => {
    expect(() => inspectImage(png(10, 10), "image/jpeg")).toThrow(AppError);
    expect(() => inspectImage(png(10, 10), "application/octet-stream")).not.toThrow();
  });

  it("rejects SVG and non-image content", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(() => inspectImage(svg, "image/svg+xml")).toThrow(AppError);
    expect(() => inspectImage(Buffer.from("not an image"), "image/png")).toThrow(
      AppError,
    );
  });

  it("rejects empty, truncated and oversized files", () => {
    expect(() => inspectImage(Buffer.alloc(0), "image/png")).toThrow(AppError);
    expect(() => inspectImage(png(10, 10).subarray(0, 20), "image/png")).toThrow(
      AppError,
    );
    expect(() =>
      inspectImage(Buffer.alloc(MAX_IMAGE_BYTES + 1), "image/png"),
    ).toThrow(AppError);
  });
});
