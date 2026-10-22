import { integer } from "drizzle-orm/sqlite-core";

/**
 * Timestamp columns are stored as UTC epoch milliseconds.
 *
 * The P0 schema mirrors the nullability of the legacy PostgreSQL schema
 * (many DEFAULT columns are nullable). `$defaultFn` only supplies a value for
 * application inserts; migrations always write the converted value explicitly.
 */
export function createdAt() {
  return integer("created_at", { mode: "timestamp_ms" }).$defaultFn(
    () => new Date(),
  );
}

export function updatedAt() {
  return integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(
    () => new Date(),
  );
}

export function booleanColumn(name: string) {
  return integer(name, { mode: "boolean" }).default(false);
}
