import postgres from "postgres";
import { IMPORT_ORDER, TABLE_BY_NAME } from "../../server/db/tables";

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
}

async function main() {
  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) {
    throw new Error("DATABASE_URL is required (PostgreSQL source)");
  }

  const pg = postgres(sourceUrl, { max: 1, idle_timeout: 10 });
  let rows: ColumnRow[] = [];

  try {
    rows = (await pg.unsafe(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `)) as unknown as ColumnRow[];
  } finally {
    await pg.end({ timeout: 5 });
  }

  const byTable = new Map<string, ColumnRow[]>();
  for (const row of rows) {
    const list = byTable.get(row.table_name) ?? [];
    list.push(row);
    byTable.set(row.table_name, list);
  }

  let errors = 0;
  let warnings = 0;

  for (const name of IMPORT_ORDER) {
    const table = TABLE_BY_NAME.get(name);
    if (!table) continue;

    const sourceColumns = byTable.get(name) ?? [];
    if (sourceColumns.length === 0) {
      console.error(`ERROR missing PostgreSQL table: ${name}`);
      errors++;
      continue;
    }

    console.log(`\n[${name}]`);
    for (const source of sourceColumns) {
      const target = table.columns.find(
        (column) => column.name === source.column_name,
      );
      console.log(
        `  ${source.column_name}: ${source.data_type}` +
          ` nullable=${source.is_nullable}` +
          (source.column_default ? ` default=${source.column_default}` : ""),
      );

      if (!target) {
        console.error(
          `ERROR ${name}.${source.column_name} missing in SQLite schema`,
        );
        errors++;
        continue;
      }
      if (source.is_nullable === "NO" && target.nullable) {
        console.warn(
          `WARN ${name}.${source.column_name} is NOT NULL in PostgreSQL but nullable in SQLite`,
        );
        warnings++;
      }
      if (source.is_nullable === "YES" && !target.nullable) {
        console.error(
          `ERROR ${name}.${source.column_name} is nullable in PostgreSQL but NOT NULL in SQLite`,
        );
        errors++;
      }
      if (
        target.kind === "timestamp" &&
        source.data_type === "timestamp with time zone"
      ) {
        console.error(
          `ERROR ${name}.${source.column_name} is timestamp with time zone; ` +
            "the importer assumes timestamp without time zone",
        );
        errors++;
      }
    }

    const sourceNames = new Set(
      sourceColumns.map((column) => column.column_name),
    );
    for (const target of table.columns) {
      if (!sourceNames.has(target.name)) {
        console.warn(`WARN ${name}.${target.name} is new in SQLite`);
        warnings++;
      }
    }
  }

  console.log(`\naudit complete: ${errors} error(s), ${warnings} warning(s)`);
  if (errors > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
