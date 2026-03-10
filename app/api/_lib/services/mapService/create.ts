import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { Map, CreateMapOptions } from "./types";

/**
 * Create a new map
 */
export async function createMap(options: CreateMapOptions): Promise<Map> {
  const sqlInstance = await sql();

  const columnResult = await sqlInstance.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'maps'
       AND table_schema = current_schema()`,
  );
  const availableColumns = new Set(extractRows(columnResult).map((row) => String(row.column_name)));

  const insertColumns = ["name", "random", "can_use_ai"];
  const insertValues: unknown[] = [
    options.name,
    options.random ?? 0,
    options.can_use_ai ?? false,
  ];

  // Some local databases still have legacy level-point columns without defaults.
  // Populate them when present so map creation works against both schemas.
  for (const columnName of ["easy_level_points", "medium_level_points", "hard_level_points"]) {
    if (availableColumns.has(columnName)) {
      insertColumns.push(columnName);
      insertValues.push(0);
    }
  }

  const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(", ");

  const result = await sqlInstance.query(
    `INSERT INTO maps (${insertColumns.join(", ")})
     VALUES (${placeholders})
     RETURNING name, random, can_use_ai, created_at, updated_at`,
    insertValues,
  );

  const rows = extractRows(result);

  if (rows.length === 0) {
    throw new Error("Failed to create map");
  }

  return {
    name: rows[0].name,
    random: rows[0].random,
    can_use_ai: rows[0].can_use_ai,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  };
}

/**
 * Add a level to a map
 */
export async function addLevelToMap(mapName: string, levelIdentifier: string): Promise<void> {
  const sqlInstance = await sql();

  await sqlInstance`
    INSERT INTO map_levels (map_name, level_identifier)
    VALUES (${mapName}, ${levelIdentifier})
    ON CONFLICT (map_name, level_identifier) DO NOTHING
  `;
}
