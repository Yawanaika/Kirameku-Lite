import crypto from "node:crypto";
import type { ColumnKind, TableMeta } from "../../server/db/tables";

export interface TableSnapshot {
  rowCount: number;
  maxId: number | null;
  contentHash: string;
  nullCounts: Record<string, number>;
  sequence: number | null;
}

export interface TableManifest {
  postgres: TableSnapshot;
  sqlite: TableSnapshot;
  ok: boolean;
  mismatches: string[];
}

export type Manifest = Record<string, TableManifest>;

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

/**
 * Legacy columns are `timestamp without time zone`. PostgreSQL's
 * `EXTRACT(EPOCH FROM timestamp)` ignores the session TimeZone, so the wall
 * clock value must be converted explicitly with `AT TIME ZONE`.
 */
const SOURCE_TIME_ZONE = "Asia/Shanghai";

export function normalizeValue(value: unknown, kind: ColumnKind): unknown {
  if (value === null || value === undefined) return null;

  switch (kind) {
    case "timestamp": {
      const milliseconds = value instanceof Date ? value.getTime() : Number(value);
      if (!Number.isFinite(milliseconds)) {
        throw new Error(`Invalid timestamp value: ${String(value)}`);
      }
      return Math.trunc(milliseconds);
    }
    case "boolean": {
      if (typeof value === "boolean") return value ? 1 : 0;
      if (value === 1 || value === "1") return 1;
      if (value === 0 || value === "0") return 0;
      if (value === "t" || value === "true") return 1;
      if (value === "f" || value === "false") return 0;
      throw new Error(`Invalid boolean value: ${String(value)}`);
    }
    case "integer":
    case "id": {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        throw new Error(`Invalid integer value: ${String(value)}`);
      }
      return Math.trunc(number);
    }
    case "json": {
      if (typeof value === "string") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        } catch {
          throw new Error(`Invalid JSON value: ${value.slice(0, 120)}`);
        }
        return JSON.stringify(parsed);
      }
      return JSON.stringify(value);
    }
    case "text":
    default:
      return String(value);
  }
}

export function normalizeRow(
  row: Record<string, unknown>,
  table: TableMeta,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const column of table.columns) {
    normalized[column.name] = normalizeValue(row[column.name], column.kind);
  }
  return normalized;
}

export function sortRows(
  rows: Record<string, unknown>[],
  table: TableMeta,
): Record<string, unknown>[] {
  const idColumn = table.columns.find((column) => column.kind === "id");
  const keys = idColumn
    ? [idColumn.name]
    : table.columns.slice(0, 2).map((column) => column.name);

  return [...rows].sort((left, right) => {
    for (const key of keys) {
      const a = left[key];
      const b = right[key];
      if (a === b) continue;
      return (a as number | string) < (b as number | string) ? -1 : 1;
    }
    return 0;
  });
}

export function hashRows(
  rows: Record<string, unknown>[],
  table: TableMeta,
): string {
  const normalized = sortRows(rows, table).map((row) =>
    table.columns.map((column) => row[column.name] ?? null),
  );
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

export function buildSnapshot(
  rows: Record<string, unknown>[],
  table: TableMeta,
  sequence: number | null,
): TableSnapshot {
  const normalizedRows = rows.map((row) => normalizeRow(row, table));
  const idColumn = table.columns.find((column) => column.kind === "id");
  const maxId = idColumn
    ? normalizedRows.reduce<number | null>((current, row) => {
        const value = row[idColumn.name];
        if (value === null) return current;
        const number = Number(value);
        return current === null || number > current ? number : current;
      }, null)
    : null;

  const nullCounts: Record<string, number> = {};
  for (const column of table.columns) {
    nullCounts[column.name] = normalizedRows.reduce(
      (count, row) => count + (row[column.name] === null ? 1 : 0),
      0,
    );
  }

  return {
    rowCount: normalizedRows.length,
    maxId,
    contentHash: hashRows(normalizedRows, table),
    nullCounts,
    sequence,
  };
}

export function buildSelectList(table: TableMeta): string {
  return table.columns
    .map((column) => {
      const identifier = quoteIdentifier(column.name);
      switch (column.kind) {
        case "timestamp":
          return `EXTRACT(EPOCH FROM (${identifier} AT TIME ZONE '${SOURCE_TIME_ZONE}')) * 1000 AS ${identifier}`;
        case "boolean":
          return `CASE WHEN ${identifier} IS NULL THEN NULL WHEN ${identifier} THEN 1 ELSE 0 END AS ${identifier}`;
        case "json":
          return `${identifier}::text AS ${identifier}`;
        default:
          return identifier;
      }
    })
    .join(", ");
}

export function compareSnapshots(
  postgres: TableSnapshot,
  sqlite: TableSnapshot,
): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  if (postgres.rowCount !== sqlite.rowCount) {
    mismatches.push(`rowCount ${postgres.rowCount} != ${sqlite.rowCount}`);
  }
  if (postgres.maxId !== sqlite.maxId) {
    mismatches.push(`maxId ${postgres.maxId} != ${sqlite.maxId}`);
  }
  if (postgres.contentHash !== sqlite.contentHash) {
    mismatches.push("contentHash differs");
  }
  const nullColumns = new Set([
    ...Object.keys(postgres.nullCounts),
    ...Object.keys(sqlite.nullCounts),
  ]);
  for (const column of nullColumns) {
    const expected = postgres.nullCounts[column] ?? 0;
    const actual = sqlite.nullCounts[column] ?? 0;
    if (expected !== actual) {
      mismatches.push(`nullCounts.${column} ${expected} != ${actual}`);
    }
  }
  if (
    postgres.maxId !== null &&
    (sqlite.sequence === null || sqlite.sequence < postgres.maxId)
  ) {
    mismatches.push(
      `sqlite_sequence ${sqlite.sequence ?? "missing"} < maxId ${postgres.maxId}`,
    );
  }

  return { ok: mismatches.length === 0, mismatches };
}
