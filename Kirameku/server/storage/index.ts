import "server-only";
import path from "node:path";
import { env } from "@/server/env";
import { errors } from "@/server/http/errors";
import { buildUploadKey, writeLocalImage } from "./local";
import { inspectImage, MAX_IMAGE_BYTES, type ImageInfo } from "./image";
import {
  buildOssPublicUrl,
  getOssConfig,
  putOssObject,
} from "./oss";

export { MAX_IMAGE_BYTES, type ImageInfo } from "./image";

export interface StoredImage {
  url: string;
  key: string;
  storage: "oss" | "local";
  width: number;
  height: number;
  orientation: ImageInfo["orientation"];
  format: ImageInfo["format"];
  size: number;
}

/** Local storage root; used when OSS is not configured or for dev uploads. */
export function getUploadRoot(): string {
  return path.resolve(env.UPLOAD_DIR ?? "uploads");
}

export async function storeImageFile(file: File): Promise<StoredImage> {
  if (file.size <= 0) throw errors.badRequest("上传文件为空");
  if (file.size > MAX_IMAGE_BYTES) {
    throw errors.payloadTooLarge("图片不能超过 10MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = inspectImage(buffer, file.type);
  const key = buildUploadKey(image.ext);
  const oss = getOssConfig();

  if (oss) {
    const objectKey = oss.prefix ? `${oss.prefix}/${key}` : key;
    await putOssObject(oss, objectKey, buffer, image.mime);
    return {
      url: buildOssPublicUrl(oss, objectKey),
      key: objectKey,
      storage: "oss",
      width: image.width,
      height: image.height,
      orientation: image.orientation,
      format: image.format,
      size: image.size,
    };
  }

  await writeLocalImage(getUploadRoot(), key, buffer);
  return {
    url: `/uploads/${key}`,
    key,
    storage: "local",
    width: image.width,
    height: image.height,
    orientation: image.orientation,
    format: image.format,
    size: image.size,
  };
}
