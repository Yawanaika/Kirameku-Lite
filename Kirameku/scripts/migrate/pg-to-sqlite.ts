import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { runMigrations } from "../../server/db/migrate";
import { openDatabase } from "../../server/db/open";
import {
  IMPORT_ORDER,
  TABLE_BY_NAME,
  type TableMeta,
} from "../../server/db/tables";
import {
  buildSelectList,
  buildSnapshot,
  compareSnapshots,
  normalizeRow,
  quoteIdentifier,
  type Manifest,
  type TableSnapshot,
} from "./manifest";

function flagValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function countRows(
  db: ReturnType<typeof openDatabase>,
  table: TableMeta,
): number {
  return (
    db
      .prepare(`SELECT count(*) AS count FROM ${quoteIdentifier(table.name)}`)
      .get() as { count: number }
  ).count;
}

function sequenceFor(
  db: ReturnType<typeof openDatabase>,
  table: TableMeta,
): number | null {
  try {
    const row = db
      .prepare('SELECT "seq" FROM "sqlite_sequence" WHERE "name" = ?')
      .get(table.name) as { seq: number } | undefined;
    return row?.seq ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) {
    throw new Error("DATABASE_URL is required (PostgreSQL source)");
  }

  const dryRun = hasFlag("--dry-run");
  const truncate = hasFlag("--truncate");
  const keepDryRun = hasFlag("--keep");
  const targetPath =
    flagValue("--target") ||
    process.env.DATABASE_PATH ||
    (dryRun ? "./data/kirameku.dry-run.db" : "./data/kirameku.db");
  const manifestPath =
    flagValue("--manifest") || "./backups/migration-manifest.json";
  const absoluteTarget = path.resolve(targetPath);
  const absoluteManifest = path.resolve(manifestPath);

  const sqlite = openDatabase(absoluteTarget);
  const postgresSnapshots = new Map<string, TableSnapshot>();
  const manifest: Manifest = {};
  let allOk = false;
  let integrityOk = false;
  let foreignKeyViolations = 0;

  try {
    const initialTableCount = (
      sqlite
        .prepare(
          "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        )
        .get() as { count: number }
    ).count;

    if (initialTableCount === 0) {
      sqlite.pragma("auto_vacuum = INCREMENTAL");
      sqlite.exec("VACUUM");
    }

    runMigrations(sqlite);

    const nonEmpty = IMPORT_ORDER.map((name) => TABLE_BY_NAME.get(name)!).filter(
      (table) => countRows(sqlite, table) > 0,
    );
    if (nonEmpty.length > 0 && !truncate) {
      throw new Error(
        `Target already contains rows in: ${nonEmpty
          .map((table) => table.name)
          .join(", ")}. Re-run with --truncate or use a fresh --target.`,
      );
    }

    if (truncate) {
      sqlite.pragma("foreign_keys = OFF");
      const clear = sqlite.transaction(() => {
        for (const name of [...IMPORT_ORDER].reverse()) {
          sqlite.exec(`DELETE FROM ${quoteIdentifier(name)}`);
        }
      });
      try {
        clear.immediate();
      } finally {
        sqlite.pragma("foreign_keys = ON");
      }
    }

    const pg = postgres(sourceUrl, {
      max: 1,
      idle_timeout: 10,
      connect_timeout: 10,
    });

    try {
      // Timestamp conversion is explicit in buildSelectList (`AT TIME ZONE`).
      // Do not rely on SET TIME ZONE: EXTRACT(EPOCH FROM timestamp without
      // time zone) ignores the session timezone. The importer currently only
      // supports `timestamp without time zone`; fail loudly instead of
      // silently shifting a `timestamptz` column by another 8 hours.
      const timestampRows = (await pg.unsafe(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type IN ('timestamp without time zone', 'timestamp with time zone')
      `)) as unknown as Array<{
        table_name: string;
        column_name: string;
        data_type: string;
      }>;
      const unsupported = timestampRows.filter(
        (row) => row.data_type === "timestamp with time zone",
      );
      if (unsupported.length > 0) {
        throw new Error(
          `Unsupported timestamp with time zone column(s): ${unsupported
            .map((row) => `${row.table_name}.${row.column_name}`)
            .join(", ")}. The migration assumes timestamp without time zone ` +
            "interpreted as Asia/Shanghai.",
        );
      }

      const postgresRows = new Map<string, Record<string, unknown>[]>();

      for (const name of IMPORT_ORDER) {
        const table = TABLE_BY_NAME.get(name);
        if (!table) throw new Error(`Unknown table in import order: ${name}`);

        const rows = (await pg.unsafe(
          `SELECT ${buildSelectList(table)} FROM ${quoteIdentifier(name)}`,
        )) as unknown as Record<string, unknown>[];
        const normalized = rows.map((row) => normalizeRow(row, table));

        postgresRows.set(name, normalized);
        postgresSnapshots.set(
          name,
          buildSnapshot(normalized, table, null),
        );
        console.log(`read ${name}: ${rows.length} row(s)`);
      }

      const insertAll = sqlite.transaction(() => {
        for (const name of IMPORT_ORDER) {
          const table = TABLE_BY_NAME.get(name);
          if (!table) throw new Error(`Unknown table in import order: ${name}`);

          const rows = postgresRows.get(name) ?? [];
          if (rows.length === 0) continue;

          const columns = table.columns
            .map((column) => quoteIdentifier(column.name))
            .join(", ");
          const placeholders = table.columns.map(() => "?").join(", ");
          const statement = sqlite.prepare(
            `INSERT INTO ${quoteIdentifier(name)} (${columns}) VALUES (${placeholders})`,
          );

          for (const row of rows) {
            statement.run(
              ...table.columns.map((column) => row[column.name] ?? null),
            );
          }
        }
      });
      sqlite.pragma("foreign_keys = OFF");
      try {
        insertAll.immediate();
      } finally {
        sqlite.pragma("foreign_keys = ON");
      }
      sqlite.pragma("wal_checkpoint(TRUNCATE)");
    } finally {
      await pg.end({ timeout: 5 });
    }

    for (const name of IMPORT_ORDER) {
      const table = TABLE_BY_NAME.get(name);
      if (!table) throw new Error(`Unknown table in import order: ${name}`);

      const rows = sqlite
        .prepare(`SELECT * FROM ${quoteIdentifier(name)}`)
        .all() as Record<string, unknown>[];
      const snapshot = buildSnapshot(
        rows,
        table,
        sequenceFor(sqlite, table),
      );
      const postgresSnapshot = postgresSnapshots.get(name);
      if (!postgresSnapshot) {
        throw new Error(`Missing PostgreSQL snapshot for ${name}`);
      }

      const comparison = compareSnapshots(postgresSnapshot, snapshot);
      manifest[name] = {
        postgres: postgresSnapshot,
        sqlite: snapshot,
        ok: comparison.ok,
        mismatches: comparison.mismatches,
      };

      if (comparison.ok) {
        console.log(`verified ${name}: ${snapshot.rowCount} row(s)`);
      } else {
        console.error(
          `MISMATCH ${name}: ${comparison.mismatches.join("; ")}`,
        );
        allOk = false;
      }
    }

    const integrity = sqlite.pragma("integrity_check") as Array<{
      integrity_check: string;
    }>;
    integrityOk =
      integrity.length === 1 && integrity[0]?.integrity_check === "ok";
    foreignKeyViolations = (
      sqlite.prepare("PRAGMA foreign_key_check").all() as unknown[]
    ).length;

    allOk =
      Object.values(manifest).every((table) => table.ok) &&
      integrityOk &&
      foreignKeyViolations === 0;

    fs.mkdirSync(path.dirname(absoluteManifest), { recursive: true });
    fs.writeFileSync(
      absoluteManifest,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: "postgresql",
          target: absoluteTarget,
          dryRun,
          integrityOk,
          foreignKeyViolations,
          tables: manifest,
          ok: allOk,
        },
        null,
        2,
      )}\n`,
    );

    console.log(`manifest: ${absoluteManifest}`);
    console.log(`integrity_check: ${integrityOk ? "ok" : "FAILED"}`);
    console.log(`foreign_key_check: ${foreignKeyViolations} violation(s)`);

    if (!allOk) {
      process.exitCode = 1;
      return;
    }

    console.log("migration verified");
  } finally {
    sqlite.close();

    if (dryRun && !keepDryRun && allOk) {
      for (const suffix of ["", "-wal", "-shm"]) {
        fs.rmSync(`${absoluteTarget}${suffix}`, { force: true });
      }
      console.log(`dry-run database removed: ${absoluteTarget}`);
    }
  }

  if (!allOk) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
