import { getSqlite } from "@/server/db/client";
import { handle } from "@/server/http/handler";

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

        return {
          ok: row?.ok === 1,
          db: "ok",
          migration: migration?.filename ?? null,
          version: "0.1.0",
        };
      } catch {
        return Response.json(
          {
            ok: false,
            db: "unavailable",
            version: "0.1.0",
          },
          { status: 503 },
        );
      }
    },
    { request },
  );
}
