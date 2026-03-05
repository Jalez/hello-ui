import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import { deleteLevel } from "./delete";

/**
 * Get identifiers of levels that are not attached to any map (orphans).
 * These can be safely purged.
 */
export async function getOrphanLevelIdentifiers(): Promise<string[]> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT l.identifier
    FROM levels l
    LEFT JOIN map_levels ml ON ml.level_identifier = l.identifier
    WHERE ml.map_name IS NULL
    ORDER BY l.created_at ASC
  `;

  const rows = extractRows(result);
  return rows.map((row: { identifier: string }) => row.identifier);
}

export interface PurgeOrphansResult {
  deleted: number;
  identifiers: string[];
}

/**
 * Delete all levels that are not part of any map.
 * Returns the number deleted and their identifiers.
 */
export async function purgeOrphanLevels(): Promise<PurgeOrphansResult> {
  const identifiers = await getOrphanLevelIdentifiers();
  let deleted = 0;

  for (const id of identifiers) {
    const ok = await deleteLevel(id);
    if (ok) deleted++;
  }

  return { deleted, identifiers };
}
