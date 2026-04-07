#!/usr/bin/env tsx
/**
 * Idempotent: creates user_tour_spot_ack when the DB was initialized outside Drizzle's
 * migration chain (so `db:migrate` cannot replay from 0000).
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { getSqlInstance } from "../app/api/_lib/db/shared";

config({ path: resolve(__dirname, "../.env.local") });

async function main() {
  const sql = await getSqlInstance();
  await sql.query(`
    CREATE TABLE IF NOT EXISTS "user_tour_spot_ack" (
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "spot_key" text NOT NULL,
      "version_seen" integer NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "user_tour_spot_ack_user_id_spot_key_pk" PRIMARY KEY("user_id","spot_key")
    );
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS "idx_user_tour_spot_ack_user_id"
    ON "user_tour_spot_ack" USING btree ("user_id");
  `);
  console.log("OK: user_tour_spot_ack table is ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
