import { is } from "drizzle-orm";
import {
  getTableConfig,
  SQLiteTable,
  type SQLiteColumn,
} from "drizzle-orm/sqlite-core";
import * as schema from "./schema";

export type ColumnKind =
  | "id"
  | "integer"
  | "text"
  | "boolean"
  | "timestamp"
  | "json";

export interface ColumnMeta {
  name: string;
  kind: ColumnKind;
  nullable: boolean;
}

export interface TableMeta {
  name: string;
  table: SQLiteTable;
  columns: ColumnMeta[];
}

/**
 * Foreign-key-safe import order. `admin_audit_log` is new and has no source
 * rows, so it is deliberately not part of the PostgreSQL import.
 */
export const IMPORT_ORDER = [
  "user",
  "category",
  "tag",
  "post",
  "post_tag",
  "github_user",
  "comment",
  "message",
  "chatter",
  "chatter_comment",
  "album",
  "photo",
  "project",
  "friend_link",
  "bookmark_category",
  "bookmark_site",
  "site_config",
  "visitor",
] as const;

const jsonColumns: Record<string, readonly string[]> = {
  chatter: ["images"],
  project: ["tech_stack"],
  bookmark_site: ["platforms"],
  admin_audit_log: ["detail"],
};

function kindOf(column: SQLiteColumn, tableName: string): ColumnKind {
  if (column.primary) return "id";
  if (jsonColumns[tableName]?.includes(column.name)) return "json";
  if (column.dataType === "boolean") return "boolean";
  if (column.dataType === "date") return "timestamp";
  if (column.dataType === "number") return "integer";
  return "text";
}

function orderOf(name: string): number {
  const index = (IMPORT_ORDER as readonly string[]).indexOf(name);
  return index === -1 ? IMPORT_ORDER.length : index;
}

export const TABLES: TableMeta[] = (Object.values(schema) as unknown[])
  .filter((value): value is SQLiteTable => is(value, SQLiteTable))
  .map((table) => {
    const config = getTableConfig(table);
    return {
      name: config.name,
      table,
      columns: config.columns.map((column) => {
        const kind = kindOf(column, config.name);
        return {
          name: column.name,
          kind,
          nullable: kind === "id" ? false : !column.notNull,
        };
      }),
    };
  })
  .sort((a, b) => orderOf(a.name) - orderOf(b.name) || a.name.localeCompare(b.name));

export const TABLE_BY_NAME = new Map(TABLES.map((table) => [table.name, table]));
