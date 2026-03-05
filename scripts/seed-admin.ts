#!/usr/bin/env tsx
/**
 * Apply the admin schema only: create admin_roles table if missing and seed
 * the default admin (raitsu11@gmail.com). Safe to run on an existing DB.
 *
 * Prerequisite: users table must exist (e.g. you have signed in at least once,
 * or run db:init previously).
 *
 * Usage: pnpm db:seed-admin
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found. Set it in .env.local");
  process.exit(1);
}

const SCRIPT_DIR = __dirname;
const ADMIN_SCHEMA = resolve(SCRIPT_DIR, "sql/admin-schema.sql");

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log("🔐 Applying admin schema (admin_roles + default admin)...");
    const adminSQL = readFileSync(ADMIN_SCHEMA, "utf-8");
    await client.query(adminSQL);
    console.log("✅ Done. Default admin: raitsu11@gmail.com");
    console.log("   Sign in with that email (any casing) to see the admin panel.");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
