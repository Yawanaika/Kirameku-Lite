import crypto from "node:crypto";
import { env } from "@/server/env";

/**
 * Channel secrets (bot token, SMTP password, webhook signing key) are sealed
 * with AES-256-GCM before they touch SQLite. The key is derived from
 * AUTH_SECRET, so a database backup on its own does not leak them.
 *
 * Values are stored as `enc:v1:<iv>.<tag>.<ciphertext>` (base64url) or, when
 * AUTH_SECRET is not configured (local dev), as `plain:<value>`.
 */
const ENCRYPTED_PREFIX = "enc:v1:";
const PLAIN_PREFIX = "plain:";

function deriveKey(): Buffer | null {
  const secret = env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return crypto
    .createHash("sha256")
    .update(`kirameku-notifications:${secret}`)
    .digest();
}

export function isSealed(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX) || value.startsWith(PLAIN_PREFIX);
}

export function sealSecret(value: string): string {
  const key = deriveKey();
  if (!key) return `${PLAIN_PREFIX}${value}`;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return (
    ENCRYPTED_PREFIX +
    [
      iv.toString("base64url"),
      tag.toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".")
  );
}

/** Returns "" when the stored value cannot be decrypted (e.g. rotated secret). */
export function openSecret(stored: string): string {
  if (!stored) return "";
  if (stored.startsWith(PLAIN_PREFIX)) {
    return stored.slice(PLAIN_PREFIX.length);
  }
  if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored;

  const key = deriveKey();
  if (!key) return "";

  const [ivPart, tagPart, dataPart] = stored
    .slice(ENCRYPTED_PREFIX.length)
    .split(".");
  if (!ivPart || !tagPart || !dataPart) return "";

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}
