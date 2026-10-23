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

/** Opt-out flag: unset means on, "0"/"false" turns it off. */
const flagOn = z.preprocess(
  (value) => !(value === false || value === "0" || value === "false"),
  z.boolean(),
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
  /**
   * Canonical public site URL used for sitemap, robots, RSS and share cards.
   * Falls back to FRONTEND_ORIGIN so a normal deployment only sets one value;
   * set it explicitly when the public hostname differs from that origin.
   */
  SITE_URL: optionalUrl,
  /** Share card (Open Graph / Twitter) overrides; defaults live in siteConfig. */
  SITE_SHARE_TITLE: optionalString,
  SITE_SHARE_DESCRIPTION: optionalString,
  /** Absolute URL or a path served by this site, e.g. /images/hong.jpg */
  SITE_SHARE_IMAGE: optionalString,
  /** Optional contact address used as the RSS <author> e-mail. */
  SITE_CONTACT_EMAIL: optionalString,
  SITE_SHARE_CARD: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.enum(["summary", "summary_large_image"]).optional(),
  ),
  OSS_ACCESS_KEY_ID: optionalString,
  OSS_ACCESS_KEY_SECRET: optionalString,
  OSS_BUCKET_NAME: optionalString,
  OSS_ENDPOINT: optionalString,
  OSS_CUSTOM_DOMAIN: optionalUrl,
  OSS_PREFIX: optionalString,
  UPLOAD_DIR: optionalString,
  /** Where scripts/backup-db.ts writes snapshots (and reads retention from). */
  BACKUP_DIR: optionalString,
  /** Delete visitor records (including IPs) after this many days. */
  VISITOR_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  /**
   * In-process alert checks (backup age, disk, error rate, pending content).
   * Disable when the deployment should only serve traffic.
   */
  NOTIFICATION_CHECKS: flagOn,
  /** How often the in-process alert checks run, in minutes. */
  NOTIFICATION_INTERVAL_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(1440)
    .default(5),
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
