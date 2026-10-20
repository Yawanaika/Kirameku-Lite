import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { booleanColumn, createdAt } from "./columns";

export const visitor = sqliteTable(
  "visitor",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ip: text("ip").notNull(),
    path: text("path").default(""),
    userAgent: text("user_agent").default(""),
    city: text("city").default(""),
    region: text("region").default(""),
    country: text("country").default(""),
    district: text("district").default(""),
    org: text("org").default(""),
    asn: text("asn").default(""),
    isMobile: booleanColumn("is_mobile"),
    isProxy: booleanColumn("is_proxy"),
    isHosting: booleanColumn("is_hosting"),
    browser: text("browser").default(""),
    os: text("os").default(""),
    deviceType: text("device_type").default(""),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_visitor_ip").on(t.ip),
    index("idx_visitor_created").on(t.createdAt),
  ],
);
