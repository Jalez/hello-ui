/**
 * When DATABASE_URL points at a database that does not exist, try well-known names
 * from this repo (Docker POSTGRES_DB is `hello_ui`).
 */

import { Pool } from "pg";

const FALLBACK_DATABASES = ["hello_ui", "ui_designer", "ui_designer_dev"] as const;

function replaceDatabaseName(connectionString: string, newDb: string): string {
  return connectionString.replace(/\/[^/?]+(\?|$)/, `/${newDb}$1`);
}

function adminConnectionString(connectionString: string): string {
  // Same as db-init.ts: keep ?query suffix; $1 is "" or "?" + end — not the db name.
  return connectionString.replace(/\/[^/?]+(\?|$)/, "/postgres$1");
}

function redactUrl(url: string): string {
  return url.replace(/:([^@/]+)@/, ":****@");
}

export async function resolvePostgresDatabaseUrl(connectionString: string): Promise<string> {
  if (
    !connectionString ||
    (!connectionString.startsWith("postgresql://") && !connectionString.startsWith("postgres://"))
  ) {
    return connectionString;
  }

  const match = connectionString.match(/\/([^/?]+)(\?|$)/);
  const requested = match ? match[1] : "";
  const adminUrl = adminConnectionString(connectionString);

  let pool: Pool | null = null;
  try {
    pool = new Pool({ connectionString: adminUrl });
    const { rows } = await pool.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datistemplate = false AND datallowconn = true ORDER BY datname`,
    );
    const names = new Set(rows.map((r) => r.datname));

    if (names.has(requested)) {
      return connectionString;
    }

    for (const candidate of FALLBACK_DATABASES) {
      if (names.has(candidate)) {
        const resolved = replaceDatabaseName(connectionString, candidate);
        console.warn(
          `[db] Database "${requested}" does not exist on this server. Using "${candidate}" (${redactUrl(resolved)}).`,
        );
        console.warn(
          `[db] Update DATABASE_URL to match Docker: .../hello_ui (see docker-compose.yml POSTGRES_DB).`,
        );
        return resolved;
      }
    }

    console.warn(
      `[db] Database "${requested}" not found. Existing databases: ${[...names].join(", ") || "(none)"}.`,
    );
  } catch (err) {
    console.warn(
      `[db] Could not list databases (${err instanceof Error ? err.message : String(err)}). Using DATABASE_URL as-is.`,
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }

  return connectionString;
}
