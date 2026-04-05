import { extractRows, getSqlInstance } from "../db/shared";
import type { TourSpotKey } from "@/lib/tour/tourSpotVersions";
import { getTourSpotVersion, isTourSpotKey } from "@/lib/tour/tourSpotVersions";

function isUndefinedTableError(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "42P01";
}

export async function getTourSpotAcksForUser(userId: string): Promise<Record<string, number>> {
  const sql = await getSqlInstance();
  try {
    const result = await sql.query(
      `SELECT spot_key, version_seen FROM user_tour_spot_ack WHERE user_id = $1`,
      [userId],
    );
    const rows = extractRows(result) as { spot_key: string; version_seen: number }[];
    const out: Record<string, number> = {};
    for (const row of rows) {
      out[row.spot_key] = row.version_seen;
    }
    return out;
  } catch (e) {
    if (isUndefinedTableError(e)) {
      return {};
    }
    throw e;
  }
}

export async function upsertTourSpotAck(
  userId: string,
  spotKey: TourSpotKey,
  versionSeen: number,
): Promise<void> {
  const expected = getTourSpotVersion(spotKey);
  if (versionSeen !== expected) {
    throw new Error(`Invalid version for ${spotKey}: expected ${expected}, got ${versionSeen}`);
  }
  const sql = await getSqlInstance();
  try {
    await sql.query(
      `INSERT INTO user_tour_spot_ack (user_id, spot_key, version_seen, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, spot_key)
       DO UPDATE SET version_seen = EXCLUDED.version_seen, updated_at = NOW()`,
      [userId, spotKey, versionSeen],
    );
  } catch (e) {
    if (isUndefinedTableError(e)) {
      return;
    }
    throw e;
  }
}

export async function upsertTourSpotAcksBatch(
  userId: string,
  acks: Record<string, number>,
): Promise<void> {
  for (const [key, ver] of Object.entries(acks)) {
    if (!isTourSpotKey(key)) {
      throw new Error(`Unknown tour spot key: ${key}`);
    }
    await upsertTourSpotAck(userId, key, ver);
  }
}

/** Remove all tour acknowledgments so the user will see guided tours again on next visit. */
export async function clearAllTourSpotAcksForUser(userId: string): Promise<void> {
  const sql = await getSqlInstance();
  try {
    await sql.query(`DELETE FROM user_tour_spot_ack WHERE user_id = $1`, [userId]);
  } catch (e) {
    if (isUndefinedTableError(e)) {
      return;
    }
    throw e;
  }
}
