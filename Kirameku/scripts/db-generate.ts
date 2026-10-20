import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const snapshot = path.join(
  process.cwd(),
  "server/db/migrations/meta/0000_snapshot.json",
);

if (!fs.existsSync(snapshot)) {
  console.error(
    "Refusing to run drizzle-kit generate: the P0 baseline is hand-written " +
      "and has no Drizzle snapshot yet.",
  );
  console.error(
    "Complete the production schema audit, create the baseline snapshot, then " +
      "remove this guard.",
  );
  process.exit(1);
}

const result = spawnSync("drizzle-kit", ["generate"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
