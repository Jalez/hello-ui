#!/usr/bin/env tsx

/**
 * Check the current state of the UI-Designer database
 */

import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { Pool } from "pg";

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL not found in environment");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function checkDatabase() {
  const client = await pool.connect();

  try {
    console.log("🔍 CHECKING UI-DESIGNER DATABASE STATE...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    // List all tables
    console.log("📋 TABLES:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    if (tables.rows.length === 0) {
      console.log("❌ No tables found - database may not be initialized");
      console.log("   Run: pnpm db:init");
    } else {
      const expectedTables = [
        "users",
        "admin_roles",
        "user_credits",
        "credit_transactions",
        "maps",
        "levels",
        "map_levels",
        "projects",
        "project_collaborators",
        "user_sessions",
        "webhook_idempotency",
        "groups",
        "group_members",
        "game_instances",
        "game_attempts",
        "game_attempt_levels",
        "game_attempt_participants",
        "game_attempt_events",
        "lti_credentials",
        "__drizzle_migrations",
      ];

      const optionalFeatureTables = ["ai_providers", "ai_models", "documents", "source_files"];
      
      const existingTables = tables.rows.map((r) => r.table_name);

      const iconFor = (name: string) => {
        if (expectedTables.includes(name)) return "✅";
        if (optionalFeatureTables.includes(name)) return "◆";
        return "📋";
      };

      console.log(`Found ${existingTables.length} tables:`);
      tables.rows.forEach((row) => {
        console.log(`  ${iconFor(row.table_name)} ${row.table_name}`);
      });

      const missingTables = expectedTables.filter((t) => !existingTables.includes(t));
      if (missingTables.length > 0) {
        console.log("\n⚠️  Missing expected tables (core + Drizzle migrate path):");
        missingTables.forEach((t) => console.log(`     - ${t}`));
      }

      const missingOptional = optionalFeatureTables.filter((t) => !existingTables.includes(t));
      if (missingOptional.length > 0) {
        console.log("\nℹ️  Optional / feature tables not present (OK if you skipped AI or documents SQL):");
        missingOptional.forEach((t) => console.log(`     - ${t}`));
      }
    }
    console.log("");

    // Users
    console.log("👤 USERS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
      const users = await client.query(`SELECT id, email, name, created_at FROM users ORDER BY created_at DESC LIMIT 10`);
      if (users.rows.length === 0) {
        console.log("(no users)");
      } else {
        console.table(users.rows);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Admin roles
    console.log("");
    console.log("🔐 ADMIN USERS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
      const admins = await client.query(`
        SELECT u.email, ar.role, ar.is_active, ar.granted_at
        FROM admin_roles ar
        JOIN users u ON ar.user_id = u.id
        ORDER BY ar.granted_at DESC
      `);
      if (admins.rows.length === 0) {
        console.log("⚠️  No admin users found");
      } else {
        console.table(admins.rows);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Maps
    console.log("");
    console.log("🗺️  MAPS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
      const maps = await client.query(`
        SELECT name, random, can_use_ai
        FROM maps
        ORDER BY name
      `);
      if (maps.rows.length === 0) {
        console.log("(no maps)");
      } else {
        console.table(maps.rows);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Levels
    console.log("");
    console.log("🎯 LEVELS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
      const levels = await client.query(`
        SELECT identifier, name, created_at
        FROM levels
        ORDER BY created_at DESC
        LIMIT 10
      `);
      console.log(`Total levels: ${levels.rows.length}`);
      if (levels.rows.length > 0) {
        console.table(levels.rows);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Projects
    console.log("");
    console.log("📁 PROJECTS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
      const projects = await client.query(`
        SELECT 
          p.id,
          p.user_id,
          p.map_name,
          p.title,
          p.created_at,
          p.updated_at
        FROM projects p
        ORDER BY p.updated_at DESC
        LIMIT 10
      `);
      if (projects.rows.length === 0) {
        console.log("(no projects)");
      } else {
        console.table(projects.rows);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Credits
    console.log("");
    console.log("💳 USER CREDITS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
      const credits = await client.query(`
        SELECT 
          u.email,
          uc.current_credits,
          uc.last_reset_date
        FROM user_credits uc
        JOIN users u ON uc.user_id = u.id
        ORDER BY uc.current_credits DESC
        LIMIT 10
      `);
      if (credits.rows.length === 0) {
        console.log("(no user credits)");
      } else {
        console.table(credits.rows);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }

    // Webhooks
    console.log("");
    console.log("🪝 RECENT WEBHOOK EVENTS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
      const webhooks = await client.query(`
        SELECT event_id, event_type, created_at
        FROM webhook_idempotency
        ORDER BY created_at DESC
        LIMIT 5
      `);
      if (webhooks.rows.length === 0) {
        console.log("(no webhook events)");
      } else {
        console.table(webhooks.rows);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }

    // AI Providers (if exists)
    console.log("");
    console.log("🤖 AI PROVIDERS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    try {
      const providers = await client.query(`
        SELECT name, slug, is_active
        FROM ai_providers
        ORDER BY name
      `);
      if (providers.rows.length === 0) {
        console.log("(AI schema not applied)");
      } else {
        console.table(providers.rows);
      }
    } catch (error: any) {
      if (error.code === "42P01") {
        console.log("(AI schema not applied)");
      } else {
        console.log(`❌ Error: ${error.message}`);
      }
    }

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Database check complete!");
    console.log("");
    
  } catch (error) {
    console.error("❌ Error checking database:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabase().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
