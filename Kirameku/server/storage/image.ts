import { errors } from "@/server/http/errors";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageFormat = "jpeg" | "png" | "webp" | "gif";

export interface ImageInfo {
  format: ImageFormat;
  mime: string;
  ext: "jpg" | "png" | "webp" | "gif";
  width: number;
  height: number;
  orientation: "landscape" | "portrait";
  size: number;
}

const FORMATS: Record<
  ImageFormat,
  { mime: string; ext: ImageInfo["ext"] }
> = {
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
  gif: { mime: "image/gif", ext: "gif" },
};

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
  0xcf,
]);

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function parsePng(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 24 || buffer.toString("ascii", 12, 16) !== "IHDR") {
    throw errors.unsupportedMediaType("PNG 文件结构不完整");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseGif(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 10) {
    throw errors.unsupportedMediaType("GIF 文件结构不完整");
  }
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function parseJpeg(buffer: Buffer): { width: number; height: number } {
  let offset = 2;

  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let marker = buffer[offset + 1];
    while (marker === 0xff) {
      offset += 1;
      marker = buffer[offset + 1];
    }

    // Standalone markers (SOI, EOI, RSTn, TEM) have no length field.
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9) break;

    if (offset + 4 > buffer.length) break;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) break;

    if (SOF_MARKERS.has(marker)) {
      if (length < 7) break;
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  throw errors.unsupportedMediaType("JPEG 文件结构不完整");
}

function parseWebp(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 30) {
    throw errors.unsupportedMediaType("WebP 文件结构不完整");
  }

  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  }
  if (chunk === "VP8L") {
    if (buffer[20] !== 0x2f) {
      throw errors.unsupportedMediaType("WebP 文件结构不完整");
    }
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8 ") {
    if (
      buffer[23] !== 0x9d ||
      buffer[24] !== 0x01 ||
      buffer[25] !== 0x2a
    ) {
      throw errors.unsupportedMediaType("WebP 文件结构不完整");
    }
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  throw errors.unsupportedMediaType("不支持的 WebP 编码");
}

function detectFormat(buffer: Buffer): ImageFormat {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }
  if (buffer.toString("ascii", 0, 6) === "GIF87a") return "gif";
  if (buffer.toString("ascii", 0, 6) === "GIF89a") return "gif";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  throw errors.unsupportedMediaType("仅支持 JPG/PNG/WebP/GIF 图片");
}

/**
 * Validate an uploaded image without loading an image decoding dependency.
 *
 * The format is detected from magic bytes instead of trusting the multipart
 * `Content-Type`; the dimensions are read from the container header. SVG is
 * deliberately rejected because it can execute scripts when served same-site.
 */
export function inspectImage(
  buffer: Buffer,
  declaredType?: string | null,
): ImageInfo {
  if (buffer.length === 0) {
    throw errors.badRequest("上传文件为空");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw errors.payloadTooLarge("图片不能超过 10MB");
  }

  const format = detectFormat(buffer);
  const meta = FORMATS[format];
  const normalizedType = declaredType?.split(";")[0]?.trim().toLowerCase();

  if (
    normalizedType &&
    normalizedType !== "application/octet-stream" &&
    normalizedType !== "binary/octet-stream" &&
    normalizedType !== meta.mime &&
    !(format === "jpeg" && normalizedType === "image/jpg")
  ) {
    throw errors.unsupportedMediaType("文件内容与声明的类型不一致");
  }

  const dimensions =
    format === "png"
      ? parsePng(buffer)
      : format === "gif"
        ? parseGif(buffer)
        : format === "jpeg"
          ? parseJpeg(buffer)
          : parseWebp(buffer);

  if (
    !Number.isSafeInteger(dimensions.width) ||
    !Number.isSafeInteger(dimensions.height) ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    throw errors.unsupportedMediaType("无法识别图片尺寸");
  }

  return {
    format,
    mime: meta.mime,
    ext: meta.ext,
    width: dimensions.width,
    height: dimensions.height,
    orientation:
      dimensions.width >= dimensions.height ? "landscape" : "portrait",
    size: buffer.length,
  };
}
