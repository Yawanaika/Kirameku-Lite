import { z } from "zod";

const flag = z.preprocess(
  (value) => value === true || value === "1" || value === "true",
  z.boolean(),
);

/** Treat blank `.env` entries as missing instead of failing validation. */
const optionalString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().url().optional(),
);

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_PATH: z.string().min(1).default("./data/kirameku.db"),
  SITE_READ_ONLY: flag,
  AUTH_SECRET: z.string().optional(),
  /** Protects /api/internal/* maintenance endpoints; disabled when unset. */
  CRON_SECRET: optionalString,
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: optionalUrl,
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"),
  OSS_ACCESS_KEY_ID: optionalString,
  OSS_ACCESS_KEY_SECRET: optionalString,
  OSS_BUCKET_NAME: optionalString,
  OSS_ENDPOINT: optionalString,
  OSS_CUSTOM_DOMAIN: optionalUrl,
  OSS_PREFIX: optionalString,
  UPLOAD_DIR: optionalString,
  /** Delete visitor records (including IPs) after this many days. */
  VISITOR_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten());
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;

/**
 * AUTH_SECRET is checked lazily so `next build` and public read-only pages do
 * not require auth configuration. Any route that signs/verifies a session must
 * call this function.
 */
export function getAuthSecret(): Uint8Array {
  const secret = env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is required and must be at least 32 characters. Generate one with: openssl rand -base64 48",
    );
  }
  return new TextEncoder().encode(secret);
}
