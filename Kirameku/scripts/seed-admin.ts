import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { hashPassword } from "../server/auth/password";
import { openDatabase } from "../server/db/open";
import * as schema from "../server/db/schema";

/**
 * 从 .env.local 补读管理员相关变量（只读 ADMIN_*，不整体加载 env 文件，
 * 避免顺带把 DATABASE_PATH 之类的值带进数据库脚本）。命令行的环境变量优先级更高。
 */
function loadAdminEnvFromDotenv(): void {
  const envFile = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    ".env.local",
  );
  if (!fs.existsSync(envFile)) return;

  const wanted = ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_NICKNAME"];
  for (const raw of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(raw);
    if (!match) continue;
    const key = match[1];
    if (!wanted.includes(key) || process.env[key]) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  loadAdminEnvFromDotenv();

  const username = (process.env.ADMIN_USERNAME || "admin").trim();
  const password = process.env.ADMIN_PASSWORD;
  const nickname = process.env.ADMIN_NICKNAME || "站长";

  if (username.length < 3 || username.length > 50) {
    throw new Error("ADMIN_USERNAME must be between 3 and 50 characters");
  }
  if (!password || password.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD is required and must be at least 12 characters. " +
        "Generate one with: openssl rand -base64 24",
    );
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("ADMIN_PASSWORD must not exceed 72 UTF-8 bytes");
  }

  const databasePath = path.resolve(
    process.env.DATABASE_PATH || "./data/kirameku.db",
  );
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = openDatabase(databasePath);
  const db = drizzle(sqlite, { schema });

  try {
    const [existing] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.username, username))
      .limit(1);

    const hashedPassword = await hashPassword(password);
    const now = new Date();

    if (existing) {
      db.update(schema.user)
        .set({
          hashedPassword,
          nickname,
          isAdmin: true,
          updatedAt: now,
        })
        .where(eq(schema.user.id, existing.id))
        .run();
      console.log(`updated admin: ${username}`);
    } else {
      db.insert(schema.user)
        .values({
          username,
          hashedPassword,
          nickname,
          isAdmin: true,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      console.log(`created admin: ${username}`);
    }
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
