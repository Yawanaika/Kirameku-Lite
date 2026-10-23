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

const jsonColumns: Record<string, readonly string[]> = {
  chatter: ["images"],
  project: ["tech_stack"],
  bookmark_site: ["platforms"],
  admin_audit_log: ["detail"],
  notification_channel: ["config"],
  notification_rule: ["channels", "settings"],
};

function kindOf(column: SQLiteColumn, tableName: string): ColumnKind {
  if (column.primary) return "id";
  if (jsonColumns[tableName]?.includes(column.name)) return "json";
  if (column.dataType === "boolean") return "boolean";
  if (column.dataType === "date") return "timestamp";
  if (column.dataType === "number") return "integer";
  return "text";
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
  .sort((a, b) => a.name.localeCompare(b.name));
