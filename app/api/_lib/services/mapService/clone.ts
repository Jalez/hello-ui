import { createLevel, getAllLevels } from "@/app/api/_lib/services/levelService";
import { createMap, addLevelToMap } from "./create";
import { getLevelsForMap, getMapByName } from "./read";
import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";

export interface CloneMapWithLevelsOptions {
  targetMapName?: string;
  allowExistingTarget?: boolean;
}

export interface CloneMapWithLevelsResult {
  mapName: string;
  sourceMapName: string;
  sourceLevelsCount: number;
  levelsCloned: number;
  reusedExistingTarget: boolean;
}

function buildDefaultMapName() {
  return `map-${crypto.randomUUID()}`;
}

async function getLegacyAllSeedLevels() {
  const sqlInstance = await sql();
  const result = await sqlInstance`
    SELECT l.identifier, l.name, l.json
    FROM levels l
    WHERE NOT EXISTS (
      SELECT 1
      FROM map_levels ml
      WHERE ml.level_identifier = l.identifier
      AND ml.map_name LIKE 'isolated-%'
    )
    ORDER BY l.name ASC, l.identifier ASC
  `;
  const rows = extractRows(result);
  return rows.map((row) => ({
    identifier: String(row.identifier),
    name: String(row.name),
    json: row.json as Record<string, unknown>,
  }));
}

export async function cloneMapWithLevels(
  sourceMapName: string,
  options: CloneMapWithLevelsOptions = {},
): Promise<CloneMapWithLevelsResult> {
  const sourceMap = await getMapByName(sourceMapName);
  if (!sourceMap) {
    throw new Error(`Source map '${sourceMapName}' not found`);
  }

  const targetMapName = options.targetMapName || buildDefaultMapName();
  const allowExistingTarget = options.allowExistingTarget ?? false;
  const existingTarget = await getMapByName(targetMapName);

  if (existingTarget && !allowExistingTarget) {
    throw new Error(`Target map '${targetMapName}' already exists`);
  }

  if (!existingTarget) {
    await createMap({
      name: targetMapName,
      random: sourceMap.random,
      can_use_ai: sourceMap.can_use_ai,
      easy_level_points: sourceMap.easy_level_points,
      medium_level_points: sourceMap.medium_level_points,
      hard_level_points: sourceMap.hard_level_points,
    });
  }

  let sourceLevels = await getLevelsForMap(sourceMapName);
  if (sourceLevels.length === 0 && sourceMapName === "all") {
    sourceLevels = await getLegacyAllSeedLevels();
    if (sourceLevels.length === 0) {
      sourceLevels = await getAllLevels();
    }
  }
  const targetLevels = await getLevelsForMap(targetMapName);

  if (allowExistingTarget && targetLevels.length > 0) {
    return {
      mapName: targetMapName,
      sourceMapName,
      sourceLevelsCount: sourceLevels.length,
      levelsCloned: 0,
      reusedExistingTarget: true,
    };
  }

  for (const sourceLevel of sourceLevels) {
    const cloned = await createLevel({
      name: sourceLevel.name,
      json: sourceLevel.json,
    });
    await addLevelToMap(targetMapName, cloned.identifier);
  }

  return {
    mapName: targetMapName,
    sourceMapName,
    sourceLevelsCount: sourceLevels.length,
    levelsCloned: sourceLevels.length,
    reusedExistingTarget: false,
  };
}
