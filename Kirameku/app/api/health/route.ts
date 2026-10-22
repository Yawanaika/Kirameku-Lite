import fs from "node:fs";
import { getSqlite } from "@/server/db/client";
import { env } from "@/server/env";
import { handle } from "@/server/http/handler";

const authConfigured = Boolean(
  env.AUTH_SECRET && env.AUTH_SECRET.length >= 32,
);

function databaseSize(): number | null {
  try {
    return fs.statSync(env.DATABASE_PATH).size;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  return handle(
    async () => {
      try {
        const sqlite = getSqlite();
        const row = sqlite.prepare("SELECT 1 AS ok").get() as
          | { ok: number }
          | undefined;
        const migration = sqlite
          .prepare(
            'SELECT "filename" FROM "__migrations" ORDER BY "applied_at" DESC LIMIT 1',
          )
          .get() as { filename: string } | undefined;

        return Response.json(
          {
            ok: row?.ok === 1,
            db: "ok",
            migration: migration?.filename ?? null,
            auth: authConfigured ? "ok" : "missing",
            version: "0.1.0",
            uptime_s: Math.round(process.uptime()),
            db_size_bytes: databaseSize(),
          },
          { headers: { "cache-control": "no-store" } },
        );
      } catch {
        return Response.json(
          {
            ok: false,
            db: "unavailable",
            auth: authConfigured ? "ok" : "missing",
            version: "0.1.0",
            uptime_s: Math.round(process.uptime()),
            db_size_bytes: null,
          },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }
    },
    { request },
  );
}
