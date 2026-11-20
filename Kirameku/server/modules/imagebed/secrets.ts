import "server-only";
import crypto from "node:crypto";
import { env } from "@/server/env";
import { errors } from "@/server/http/errors";

const PREFIX = "enc:v1:";

function key(): Buffer {
  const secret = env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw errors.validation("请先配置至少 32 个字符的 AUTH_SECRET，图床 Token 才能安全保存和使用");
  }
  return crypto.createHash("sha256").update("kirameku-imagebed:" + secret).digest();
}

export function encryptImagebedToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptImagebedToken(value: string): string {
  if (!value.startsWith(PREFIX)) {
    throw errors.internal("图床 Token 的加密格式无效，请在站点设置中重新保存");
  }
  const [ivText, tagText, ciphertextText] = value.slice(PREFIX.length).split(".");
  if (!ivText || !tagText || !ciphertextText) {
    throw errors.internal("图床 Token 的加密数据无效，请在站点设置中重新保存");
  }
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw errors.internal("无法解密图床 Token，请确认 AUTH_SECRET 与保存时一致");
  }
}
