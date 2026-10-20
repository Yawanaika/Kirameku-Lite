import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./server/db/schema/index.ts",
  out: "./server/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_PATH || "./data/kirameku.db",
  },
});
