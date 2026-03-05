#!/usr/bin/env tsx

import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { Pool, type PoolClient } from "pg";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not found in environment");
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const isApply = args.has("--apply");
const isDryRun = !isApply || args.has("--dry-run");

type SharedMapRow = {
  map_name: string;
  game_count: string | number;
};

type ProjectRow = {
  id: string;
  map_name: string;
  created_at: Date;
};

type MapRow = {
  name: string;
  random: number;
  can_use_ai: boolean;
};

type SourceLevelRow = {
  identifier: string;
  name: string;
  json: Record<string, unknown>;
};

const pool = new Pool({ connectionString: DATABASE_URL });

const summary = {
  sharedMapsFound: 0,
  gamesScanned: 0,
  gamesPlannedToMove: 0,
  gamesMoved: 0,
  mapsCreated: 0,
  levelsCloned: 0,
  skippedAlreadyIsolated: 0,
  backfilledIsolatedMaps: 0,
  failures: 0,
};

function toCount(value: string | number): number {
  return typeof value === "number" ? value : Number.parseInt(value, 10);
}

async function loadSharedMapGroups(client: PoolClient): Promise<SharedMapRow[]> {
  const result = await client.query<SharedMapRow>(
    `
      SELECT map_name, COUNT(*) AS game_count
      FROM projects
      GROUP BY map_name
      HAVING COUNT(*) > 1
      ORDER BY map_name ASC
    `,
  );
  return result.rows;
}

async function loadGamesForMap(client: PoolClient, mapName: string): Promise<ProjectRow[]> {
  const result = await client.query<ProjectRow>(
    `
      SELECT id, map_name, created_at
      FROM projects
      WHERE map_name = $1
      ORDER BY created_at ASC, id ASC
    `,
    [mapName],
  );
  return result.rows;
}

async function loadMap(client: PoolClient, mapName: string): Promise<MapRow | null> {
  const result = await client.query<MapRow>(
    `
      SELECT name, random, can_use_ai
      FROM maps
      WHERE name = $1
      LIMIT 1
    `,
    [mapName],
  );
  return result.rows[0] ?? null;
}

async function loadLevelsForMap(client: PoolClient, mapName: string): Promise<SourceLevelRow[]> {
  const result = await client.query<SourceLevelRow>(
    `
      SELECT l.identifier, l.name, l.json
      FROM levels l
      INNER JOIN map_levels ml ON ml.level_identifier = l.identifier
      WHERE ml.map_name = $1
      ORDER BY l.name ASC, l.identifier ASC
    `,
    [mapName],
  );
  if (result.rows.length > 0) {
    return result.rows;
  }

  // Legacy fallback: historical "all" map behavior loaded global levels.
  if (mapName === "all") {
    const globalLevels = await client.query<SourceLevelRow>(
      `
        SELECT identifier, name, json
        FROM levels
        WHERE NOT EXISTS (
          SELECT 1
          FROM map_levels ml
          WHERE ml.level_identifier = levels.identifier
          AND ml.map_name LIKE 'isolated-%'
        )
        ORDER BY name ASC, identifier ASC
      `,
    );
    if (globalLevels.rows.length > 0) {
      return globalLevels.rows;
    }

    // Last resort fallback for empty/non-standard datasets.
    const anyLevels = await client.query<SourceLevelRow>(
      `
        SELECT identifier, name, json
        FROM levels
        ORDER BY name ASC, identifier ASC
      `,
    );
    return anyLevels.rows;
  }

  return result.rows;
}

async function ensureTargetMap(client: PoolClient, sourceMapName: string, targetMapName: string): Promise<boolean> {
  const existing = await loadMap(client, targetMapName);
  if (existing) {
    return false;
  }

  const source = await loadMap(client, sourceMapName);
  if (!source) {
    throw new Error(`Source map '${sourceMapName}' not found`);
  }

  await client.query(
    `
      INSERT INTO maps (name, random, can_use_ai)
      VALUES ($1, $2, $3)
    `,
    [
      targetMapName,
      source.random,
      source.can_use_ai,
    ],
  );

  return true;
}

async function targetMapHasLevels(client: PoolClient, targetMapName: string): Promise<boolean> {
  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM map_levels
      WHERE map_name = $1
    `,
    [targetMapName],
  );
  return Number.parseInt(result.rows[0]?.count ?? "0", 10) > 0;
}

async function cloneLevelsToTargetMap(
  client: PoolClient,
  sourceMapName: string,
  targetMapName: string,
): Promise<number> {
  const alreadyHasLevels = await targetMapHasLevels(client, targetMapName);
  if (alreadyHasLevels) {
    return 0;
  }

  const sourceLevels = await loadLevelsForMap(client, sourceMapName);
  let cloned = 0;

  for (const level of sourceLevels) {
    const insertedLevel = await client.query<{ identifier: string }>(
      `
        INSERT INTO levels (name, json)
        VALUES ($1, $2)
        RETURNING identifier
      `,
      [level.name, level.json],
    );
    const newIdentifier = insertedLevel.rows[0]?.identifier;
    if (!newIdentifier) {
      throw new Error(`Failed to clone level '${level.identifier}' from map '${sourceMapName}'`);
    }

    await client.query(
      `
        INSERT INTO map_levels (map_name, level_identifier)
        VALUES ($1, $2)
        ON CONFLICT (map_name, level_identifier) DO NOTHING
      `,
      [targetMapName, newIdentifier],
    );

    cloned += 1;
  }

  return cloned;
}

async function migrateGameToIsolatedMap(client: PoolClient, game: ProjectRow, sourceMapName: string): Promise<void> {
  const targetMapName = `isolated-${game.id}`;
  if (game.map_name === targetMapName) {
    summary.skippedAlreadyIsolated += 1;
    return;
  }

  summary.gamesPlannedToMove += 1;

  if (isDryRun) {
    console.log(`[dry-run] game ${game.id} would move ${sourceMapName} -> ${targetMapName}`);
    return;
  }

  await client.query("BEGIN");
  try {
    const currentGameResult = await client.query<ProjectRow>(
      `
        SELECT id, map_name, created_at
        FROM projects
        WHERE id = $1
        FOR UPDATE
      `,
      [game.id],
    );
    const currentGame = currentGameResult.rows[0];
    if (!currentGame) {
      throw new Error(`Game '${game.id}' not found while migrating`);
    }
    if (currentGame.map_name === targetMapName) {
      summary.skippedAlreadyIsolated += 1;
      await client.query("COMMIT");
      return;
    }

    const createdTargetMap = await ensureTargetMap(client, currentGame.map_name, targetMapName);
    if (createdTargetMap) {
      summary.mapsCreated += 1;
    }

    const clonedCount = await cloneLevelsToTargetMap(client, currentGame.map_name, targetMapName);
    summary.levelsCloned += clonedCount;

    await client.query(
      `
        UPDATE projects
        SET map_name = $1, updated_at = NOW()
        WHERE id = $2
      `,
      [targetMapName, currentGame.id],
    );

    await client.query("COMMIT");
    summary.gamesMoved += 1;
    console.log(`[apply] game ${currentGame.id} moved to ${targetMapName} (cloned ${clonedCount} levels)`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function loadEmptyIsolatedGameMaps(client: PoolClient): Promise<Array<{ game_id: string; map_name: string }>> {
  const result = await client.query<{ game_id: string; map_name: string }>(
    `
      SELECT p.id AS game_id, p.map_name
      FROM projects p
      WHERE p.map_name LIKE 'isolated-%'
      AND NOT EXISTS (
        SELECT 1
        FROM map_levels ml
        WHERE ml.map_name = p.map_name
      )
      ORDER BY p.created_at ASC, p.id ASC
    `,
  );
  return result.rows;
}

async function backfillEmptyIsolatedMaps(client: PoolClient): Promise<void> {
  const emptyMaps = await loadEmptyIsolatedGameMaps(client);
  if (emptyMaps.length === 0) {
    return;
  }

  for (const row of emptyMaps) {
    if (isDryRun) {
      console.log(`[dry-run] isolated map ${row.map_name} for game ${row.game_id} would be backfilled from global levels`);
      continue;
    }

    await client.query("BEGIN");
    try {
      const clonedCount = await cloneLevelsToTargetMap(client, "all", row.map_name);
      await client.query("COMMIT");
      summary.levelsCloned += clonedCount;
      summary.backfilledIsolatedMaps += 1;
      console.log(`[apply] backfilled isolated map ${row.map_name} for game ${row.game_id} (cloned ${clonedCount} levels)`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

async function run() {
  const client = await pool.connect();
  try {
    console.log(`Mode: ${isDryRun ? "dry-run" : "apply"}`);
    const sharedMaps = await loadSharedMapGroups(client);
    summary.sharedMapsFound = sharedMaps.length;

    if (sharedMaps.length === 0) {
      console.log("No shared maps found. Checking empty isolated maps for backfill.");
    } else {
      for (const mapRow of sharedMaps) {
        const mapName = mapRow.map_name;
        const count = toCount(mapRow.game_count);
        console.log(`Shared map '${mapName}' used by ${count} games`);

        const games = await loadGamesForMap(client, mapName);
        summary.gamesScanned += games.length;
        if (games.length <= 1) {
          continue;
        }

        // Keep the oldest game on original map, isolate every other game.
        for (let index = 1; index < games.length; index += 1) {
          const game = games[index];
          try {
            await migrateGameToIsolatedMap(client, game, mapName);
          } catch (error) {
            summary.failures += 1;
            console.error(`Failed to migrate game ${game.id}:`, error);
          }
        }
      }
    }

    await backfillEmptyIsolatedMaps(client);
  } finally {
    client.release();
    await pool.end();
  }

  console.log("");
  console.log("Migration summary");
  console.log("=================");
  console.log(`sharedMapsFound: ${summary.sharedMapsFound}`);
  console.log(`gamesScanned: ${summary.gamesScanned}`);
  console.log(`gamesPlannedToMove: ${summary.gamesPlannedToMove}`);
  console.log(`gamesMoved: ${summary.gamesMoved}`);
  console.log(`mapsCreated: ${summary.mapsCreated}`);
  console.log(`levelsCloned: ${summary.levelsCloned}`);
  console.log(`skippedAlreadyIsolated: ${summary.skippedAlreadyIsolated}`);
  console.log(`backfilledIsolatedMaps: ${summary.backfilledIsolatedMaps}`);
  console.log(`failures: ${summary.failures}`);
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
