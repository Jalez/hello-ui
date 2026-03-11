import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const { Client } = pg;

function parseArgs(argv) {
  const args = {
    out: "local-lti-name-merge-plan.json",
    canonical: "oldest",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") {
      args.out = argv[i + 1] || args.out;
      i += 1;
      continue;
    }
    if (arg === "--canonical") {
      args.canonical = argv[i + 1] || args.canonical;
      i += 1;
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
    if (!["oldest", "newest"].includes(args.canonical)) {
      throw new Error("--canonical must be either oldest or newest");
    }

    const result = await client.query(
      `SELECT id, email, name, created_at
       FROM users
       WHERE email LIKE 'lti-%@lti.local'
         AND COALESCE(TRIM(name), '') <> ''
       ORDER BY LOWER(TRIM(name)) ASC, created_at ASC, email ASC`,
    );

    const grouped = new Map();
    for (const row of result.rows) {
      const key = String(row.name).trim().toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(row);
    }

    const merges = [];
    const groups = [];

    for (const [nameKey, rows] of grouped.entries()) {
      if (rows.length < 2) {
        continue;
      }

      const orderedRows = args.canonical === "newest" ? [...rows].reverse() : rows;
      const canonical = orderedRows[0];
      const duplicates = orderedRows.slice(1);
      groups.push({
        name: canonical.name,
        canonicalUserId: canonical.id,
        canonicalEmail: canonical.email,
        duplicates: duplicates.map((row) => ({
          userId: row.id,
          email: row.email,
          createdAt: row.created_at,
        })),
      });

      for (const duplicate of duplicates) {
        merges.push({
          fromUserId: duplicate.id,
          toUserId: canonical.id,
          reason: `local exact-name LTI duplicate: ${canonical.name}`,
        });
      }
    }

    const output = {
      generatedAt: new Date().toISOString(),
      note: "Local-only helper. Assumes exact same non-empty LTI display name means the same person.",
      canonicalPolicy: args.canonical,
      groups,
      merges,
    };

    const outPath = path.resolve(process.cwd(), args.out);
    await fs.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

    console.log(`Found ${groups.length} duplicate-name group(s) and ${merges.length} merge pair(s).`);
    console.log(`Wrote merge plan to ${outPath}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
