import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` throws when resolved through the browser condition that
      // Vitest uses. Tests run in Node, so stub it out.
      "server-only": fileURLToPath(
        new URL("./tests/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
      CRON_SECRET: "test-cron-secret-0123456789abcdef",
    },
  },
});
