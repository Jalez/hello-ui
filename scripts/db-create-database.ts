#!/usr/bin/env tsx
/**
 * Create the database named in DATABASE_URL if it does not exist (connects via .../postgres).
 * Use before `pnpm db:migrate` when Postgres is up but the target DB was never created.
 */

import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL || !DATABASE_URL.startsWith("postgresql")) {
  console.error("❌ DATABASE_URL must be a postgresql:// connection string (see .env.local).");
  process.exit(1);
}

const dbUrlMatch = DATABASE_URL.match(/\/([^/?]+)(\?|$)/);
const targetDbName = dbUrlMatch ? dbUrlMatch[1] : "hello_ui";
const postgresUrl = DATABASE_URL.replace(/\/[^/?]+(\?|$)/, "/postgres$1");

async function main() {
  const tempPool = new Pool({ connectionString: postgresUrl });
  const client = await tempPool.connect();
  try {
    const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [targetDbName]);
    if (result.rows.length === 0) {
      console.log(`Creating database "${targetDbName}"...`);
      await client.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(
        `✅ Created "${targetDbName}". Next: pnpm db:init -- -y (loads tables from scripts/sql), then pnpm db:migrate (Drizzle migrations).`,
      );
    } else {
      console.log(`✅ Database "${targetDbName}" already exists.`);
    }
  } finally {
    client.release();
    await tempPool.end();
  }
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
