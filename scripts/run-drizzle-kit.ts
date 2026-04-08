#!/usr/bin/env tsx
/**
 * Runs drizzle-kit with DATABASE_URL adjusted when the path names a missing DB
 * but `hello_ui`, `ui_designer`, or `ui_designer_dev` exists (matches Docker POSTGRES_DB).
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";
import { resolvePostgresDatabaseUrl } from "./resolve-postgres-database-url";

config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const drizzleArgs = process.argv.slice(2);
  if (drizzleArgs.length === 0) {
    console.error("Usage: tsx scripts/run-drizzle-kit.ts <drizzle-kit subcommand> [args...]");
    console.error("Example: tsx scripts/run-drizzle-kit.ts migrate");
    process.exit(1);
  }

  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  const resolved = await resolvePostgresDatabaseUrl(raw);
  process.env.DATABASE_URL = resolved;
  if (process.env.POSTGRES_URL) {
    process.env.POSTGRES_URL = resolved;
  }

  const root = resolve(__dirname, "..");
  const child = spawn("npx", ["drizzle-kit", ...drizzleArgs], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
