import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const { Client } = pg;

function parseArgs(argv) {
  const args = {
    file: "",
    dryRun: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      args.file = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (arg === "--apply") {
      args.dryRun = false;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
  }

  return args;
}

function assertUuid(value, label) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid UUID for ${label}: ${value}`);
  }
}

async function loadPlan(filePath) {
  if (!filePath) {
    throw new Error("Missing --file <path-to-merge-plan.json>");
  }
  const raw = await fs.readFile(path.resolve(process.cwd(), filePath), "utf8");
  const parsed = JSON.parse(raw);
  const merges = Array.isArray(parsed) ? parsed : parsed.merges;
  if (!Array.isArray(merges) || merges.length === 0) {
    throw new Error("Merge plan must be an array or an object with a non-empty `merges` array");
  }
  for (const entry of merges) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Every merge entry must be an object");
    }
    assertUuid(String(entry.fromUserId || ""), "fromUserId");
    assertUuid(String(entry.toUserId || ""), "toUserId");
    if (entry.fromUserId === entry.toUserId) {
      throw new Error(`fromUserId and toUserId must differ: ${entry.fromUserId}`);
    }
  }
  return merges;
}

async function getUser(client, userId) {
  const result = await client.query(
    `SELECT id, email, name, created_at, updated_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT to_regclass($1) AS regclass`,
    [tableName],
  );
  return Boolean(result.rows[0]?.regclass);
}

async function getUserReferenceSummary(client, userId) {
  const queries = [
    ["projects_owner", "SELECT COUNT(*)::int AS count FROM projects WHERE user_id = $1"],
    ["project_collaborators", "SELECT COUNT(*)::int AS count FROM project_collaborators WHERE user_id = $1 OR added_by = $1"],
    ["groups_created", "SELECT COUNT(*)::int AS count FROM groups WHERE created_by = $1"],
    ["group_members", "SELECT COUNT(*)::int AS count FROM group_members WHERE user_id = $1"],
    ["game_instances", "SELECT COUNT(*)::int AS count FROM game_instances WHERE user_id = $1"],
    ["game_attempts", "SELECT COUNT(*)::int AS count FROM game_attempts WHERE user_id = $1"],
    ["game_attempt_participants", "SELECT COUNT(*)::int AS count FROM game_attempt_participants WHERE user_id = $1"],
    ["game_attempt_events", "SELECT COUNT(*)::int AS count FROM game_attempt_events WHERE user_id = $1"],
    ["model_usage_analytics", "SELECT COUNT(*)::int AS count FROM model_usage_analytics WHERE user_id = $1"],
    ["user_default_models", "SELECT COUNT(*)::int AS count FROM user_default_models WHERE user_id = $1"],
    ["user_credits", "SELECT COUNT(*)::int AS count FROM user_credits WHERE user_id = $1"],
    ["credit_transactions", "SELECT COUNT(*)::int AS count FROM credit_transactions WHERE user_id = $1"],
    ["admin_roles", "SELECT COUNT(*)::int AS count FROM admin_roles WHERE user_id = $1 OR granted_by = $1"],
  ];

  const summary = {};
  for (const [label, sql] of queries) {
    const tableName = String(sql.match(/from\s+([a-z_]+)/i)?.[1] || "");
    if (tableName && !(await tableExists(client, tableName))) {
      summary[label] = "missing_table";
      continue;
    }
    const result = await client.query(sql, [userId]);
    summary[label] = Number(result.rows[0]?.count || 0);
  }
  return summary;
}

async function mergeOne(client, fromUserId, toUserId) {
  const fromUser = await getUser(client, fromUserId);
  const toUser = await getUser(client, toUserId);

  if (!fromUser) {
    throw new Error(`Source user not found: ${fromUserId}`);
  }
  if (!toUser) {
    throw new Error(`Target user not found: ${toUserId}`);
  }

  const hasTable = async (name) => tableExists(client, name);

  await client.query("SAVEPOINT merge_user_identity");
  try {
    await client.query(
      `UPDATE projects
       SET user_id = $2, updated_at = NOW()
       WHERE user_id = $1`,
      [fromUserId, toUserId],
    );

    await client.query(
      `UPDATE groups
       SET created_by = $2, updated_at = NOW()
       WHERE created_by = $1`,
      [fromUserId, toUserId],
    );

    await client.query(
      `INSERT INTO project_collaborators (project_id, user_id, added_by, created_at)
       SELECT pc.project_id, $2,
              CASE WHEN pc.added_by = $1 THEN $2 ELSE pc.added_by END,
              pc.created_at
       FROM project_collaborators pc
       WHERE pc.user_id = $1
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [fromUserId, toUserId],
    );
    await client.query(
      `UPDATE project_collaborators
       SET added_by = $2
       WHERE added_by = $1`,
      [fromUserId, toUserId],
    );
    await client.query(`DELETE FROM project_collaborators WHERE user_id = $1`, [fromUserId]);

    await client.query(
      `INSERT INTO group_members (group_id, user_id, role, joined_at, created_at, updated_at)
       SELECT gm.group_id, $2, gm.role, gm.joined_at, gm.created_at, NOW()
       FROM group_members gm
       WHERE gm.user_id = $1
       ON CONFLICT (group_id, user_id)
       DO UPDATE SET
         role = EXCLUDED.role,
         updated_at = NOW()`,
      [fromUserId, toUserId],
    );
    await client.query(`DELETE FROM group_members WHERE user_id = $1`, [fromUserId]);

    await client.query(
      `UPDATE game_instances
       SET user_id = $2, updated_at = NOW()
       WHERE user_id = $1`,
      [fromUserId, toUserId],
    );

    await client.query(`UPDATE game_attempts SET user_id = $2, updated_at = NOW() WHERE user_id = $1`, [fromUserId, toUserId]);
    await client.query(`UPDATE game_attempt_participants SET user_id = $2 WHERE user_id = $1`, [fromUserId, toUserId]);
    await client.query(`UPDATE game_attempt_events SET user_id = $2 WHERE user_id = $1`, [fromUserId, toUserId]);

    if (await hasTable("model_usage_analytics")) {
      await client.query(`UPDATE model_usage_analytics SET user_id = $2 WHERE user_id = $1`, [fromUserId, toUserId]);
    }

    if (await hasTable("user_default_models")) {
      await client.query(
        `INSERT INTO user_default_models (user_id, text_model, image_model, image_ocr_model, pdf_ocr_model, created_at, updated_at)
         SELECT $2, udm.text_model, udm.image_model, udm.image_ocr_model, udm.pdf_ocr_model, udm.created_at, NOW()
         FROM user_default_models udm
         WHERE udm.user_id = $1
         ON CONFLICT (user_id)
         DO UPDATE SET
           text_model = COALESCE(user_default_models.text_model, EXCLUDED.text_model),
           image_model = COALESCE(user_default_models.image_model, EXCLUDED.image_model),
           image_ocr_model = COALESCE(user_default_models.image_ocr_model, EXCLUDED.image_ocr_model),
           pdf_ocr_model = COALESCE(user_default_models.pdf_ocr_model, EXCLUDED.pdf_ocr_model),
           updated_at = NOW()`,
        [fromUserId, toUserId],
      );
      await client.query(`DELETE FROM user_default_models WHERE user_id = $1`, [fromUserId]);
    }

    if (await hasTable("user_credits")) {
      await client.query(
        `INSERT INTO user_credits (
           user_id, current_credits, total_credits_earned, total_credits_used,
           last_reset_date, created_at, updated_at
         )
         SELECT
           $2,
           uc.current_credits,
           uc.total_credits_earned,
           uc.total_credits_used,
           uc.last_reset_date,
           uc.created_at,
           NOW()
         FROM user_credits uc
         WHERE uc.user_id = $1
         ON CONFLICT (user_id)
         DO UPDATE SET
           current_credits = user_credits.current_credits + EXCLUDED.current_credits,
           total_credits_earned = user_credits.total_credits_earned + EXCLUDED.total_credits_earned,
           total_credits_used = user_credits.total_credits_used + EXCLUDED.total_credits_used,
           last_reset_date = GREATEST(user_credits.last_reset_date, EXCLUDED.last_reset_date),
           updated_at = NOW()`,
        [fromUserId, toUserId],
      );
      await client.query(`DELETE FROM user_credits WHERE user_id = $1`, [fromUserId]);
    }
    if (await hasTable("credit_transactions")) {
      await client.query(`UPDATE credit_transactions SET user_id = $2 WHERE user_id = $1`, [fromUserId, toUserId]);
    }

    const sourceRoleResult = await client.query(
      `SELECT role, is_active, granted_at, created_at, updated_at
       FROM admin_roles
       WHERE user_id = $1
       LIMIT 1`,
      [fromUserId],
    );
    const sourceRole = sourceRoleResult.rows[0] || null;
    if (sourceRole) {
      await client.query(
        `INSERT INTO admin_roles (user_id, role, granted_by, granted_at, is_active, created_at, updated_at)
         VALUES ($2, $3, NULL, $4, $5, $6, NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [fromUserId, toUserId, sourceRole.role, sourceRole.granted_at, sourceRole.is_active, sourceRole.created_at],
      );
    }
    await client.query(`UPDATE admin_roles SET granted_by = $2, updated_at = NOW() WHERE granted_by = $1`, [fromUserId, toUserId]);
    await client.query(`DELETE FROM admin_roles WHERE user_id = $1`, [fromUserId]);

    await client.query(`DELETE FROM users WHERE id = $1`, [fromUserId]);
    await client.query("RELEASE SAVEPOINT merge_user_identity");

    return {
      fromUser,
      toUser,
    };
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT merge_user_identity");
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const merges = await loadPlan(args.file);
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("POSTGRES_URL or DATABASE_URL must be set");
  }

  const client = new Client({
    connectionString,
    ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    console.log(`Loaded ${merges.length} merge pair(s) from ${args.file}`);

    for (const entry of merges) {
      const fromUser = await getUser(client, entry.fromUserId);
      const toUser = await getUser(client, entry.toUserId);
      const summary = await getUserReferenceSummary(client, entry.fromUserId);
      console.log("");
      console.log(`from: ${entry.fromUserId} ${fromUser ? `(${fromUser.email})` : "(missing)"}`);
      console.log(`to:   ${entry.toUserId} ${toUser ? `(${toUser.email})` : "(missing)"}`);
      console.log(`refs: ${JSON.stringify(summary)}`);
      if (entry.reason) {
        console.log(`reason: ${entry.reason}`);
      }
    }

    if (args.dryRun) {
      console.log("");
      console.log("Dry run only. Re-run with --apply to perform the merge.");
      return;
    }

    await client.query("BEGIN");
    const merged = [];
    for (const entry of merges) {
      merged.push(await mergeOne(client, entry.fromUserId, entry.toUserId));
    }
    await client.query("COMMIT");

    console.log("");
    console.log(`Merged ${merged.length} user identity pair(s).`);
    for (const entry of merged) {
      console.log(`merged ${entry.fromUser.id} (${entry.fromUser.email}) -> ${entry.toUser.id} (${entry.toUser.email})`);
    }
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
