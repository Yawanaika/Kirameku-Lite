import "server-only";
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { env } from "@/server/env";
import { openDatabase } from "./open";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __kiramekuSqlite?: Database.Database;
  __kiramekuDrizzle?: BetterSQLite3Database<typeof schema>;
};

let sqliteInstance: Database.Database | undefined;
let drizzleInstance: BetterSQLite3Database<typeof schema> | undefined;

function open(): Database.Database {
  const file = path.resolve(env.DATABASE_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return openDatabase(file);
}

/**
 * The connection is created on first use, not at module import time. This keeps
 * `next build` working in environments where the production data volume is not
 * mounted yet and lets read-only pages build without touching SQLite.
 */
export function getSqlite(): Database.Database {
  if (globalForDb.__kiramekuSqlite) return globalForDb.__kiramekuSqlite;
  if (!sqliteInstance) sqliteInstance = open();
  if (env.NODE_ENV !== "production") globalForDb.__kiramekuSqlite = sqliteInstance;
  return sqliteInstance;
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (globalForDb.__kiramekuDrizzle) return globalForDb.__kiramekuDrizzle;
  if (!drizzleInstance) drizzleInstance = drizzle(getSqlite(), { schema });
  if (env.NODE_ENV !== "production") globalForDb.__kiramekuDrizzle = drizzleInstance;
  return drizzleInstance;
}
