import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import { deleteMap } from "./delete";

/**
 * Get names of maps that are not attached to any game (orphans).
 * These can be safely purged; deleting a map cascades to its map_levels.
 */
export async function getOrphanMapNames(): Promise<string[]> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT m.name
    FROM maps m
    LEFT JOIN projects p ON p.map_name = m.name
    WHERE p.id IS NULL
    ORDER BY m.created_at ASC
  `;

  const rows = extractRows(result);
  return rows.map((row: { name: string }) => row.name);
}

export interface PurgeOrphanMapsResult {
  deleted: number;
  names: string[];
}

/**
 * Delete all maps that are not used by any game.
 * Cascade removes their map_levels; levels that were only on these maps become orphan levels.
 */
export async function purgeOrphanMaps(): Promise<PurgeOrphanMapsResult> {
  const names = await getOrphanMapNames();
  let deleted = 0;

  for (const name of names) {
    const ok = await deleteMap(name);
    if (ok) deleted++;
  }

  return { deleted, names };
}
