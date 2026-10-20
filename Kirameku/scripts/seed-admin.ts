import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { hashPassword } from "../server/auth/password";
import { openDatabase } from "../server/db/open";
import * as schema from "../server/db/schema";

async function main() {
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
