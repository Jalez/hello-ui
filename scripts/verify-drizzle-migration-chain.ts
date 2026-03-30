#!/usr/bin/env tsx
/**
 * Validates that Drizzle migrations have been applied and critical objects exist.
 * Use after `pnpm db:init` (or Docker SQL bootstrap) + `pnpm db:migrate`.
 *
 * Note: This repo does not yet ship a single baseline migration for the entire
 * historical SQL schema — an empty database still needs the SQL bootstrap before migrate.
 */

import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required (e.g. from .env.local)");
  process.exit(1);
}

/** Must match the number of SQL files listed in lib/db/migrations/meta/_journal.json */
const EXPECTED_MIGRATION_COUNT = 2;

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();
  let failed = false;

  try {
    const mig = await client.query<{ name: string }>(
      `SELECT name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'`,
    );
    if (mig.rows.length === 0) {
      console.error("❌ __drizzle_migrations missing — run `pnpm db:migrate`");
      failed = true;
    } else {
      const applied = await client.query<{ id: number }>(`SELECT id FROM __drizzle_migrations ORDER BY id`);
      const n = applied.rows.length;
      if (n < EXPECTED_MIGRATION_COUNT) {
        console.error(`❌ Expected at least ${EXPECTED_MIGRATION_COUNT} Drizzle migration(s), found ${n}`);
        failed = true;
      } else {
        console.log(`✅ __drizzle_migrations: ${n} row(s)`);
      }
    }

    const col = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'projects'
       AND column_name IN ('drawboard_capture_mode', 'manual_drawboard_capture', 'remote_sync_debounce_ms', 'group_id')`,
    );
    const have = new Set(col.rows.map((r: { column_name: string }) => r.column_name));
    for (const c of ["drawboard_capture_mode", "manual_drawboard_capture", "remote_sync_debounce_ms", "group_id"]) {
      if (!have.has(c)) {
        console.error(`❌ projects.${c} column missing`);
        failed = true;
      }
    }
    if (!failed) console.log("✅ projects runtime + group_id columns present");

    const lti = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lti_credentials'`,
    );
    if (lti.rows.length === 0) {
      console.error("❌ lti_credentials table missing");
      failed = true;
    } else {
      console.log("✅ lti_credentials table present");
    }
  } finally {
    client.release();
    await pool.end();
  }

  if (failed) {
    console.error("\n❌ verify-drizzle-migration-chain failed");
    process.exit(1);
  }
  console.log("\n✅ verify-drizzle-migration-chain passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
