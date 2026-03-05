import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { countGamesUsingMap, getGameById, updateGameMapName } from "@/app/api/_lib/services/gameService";
import { cloneMapWithLevels } from "@/app/api/_lib/services/mapService";
import debug from "debug";

const logger = debug("ui_designer:api:games:isolate-map");

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    const game = await getGameById(id, actorIdentifiers);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    if (!game.can_edit) {
      return NextResponse.json({ error: "No edit access for this game" }, { status: 403 });
    }

    const usageCount = await countGamesUsingMap(game.map_name);
    logger("Map usage check for game %s map %s: %d", id, game.map_name, usageCount);

    const shouldIsolateLegacyAll = game.map_name === "all";
    if (usageCount <= 1 && !shouldIsolateLegacyAll) {
      return NextResponse.json({
        isolated: false,
        reason: "already_unique",
        mapName: game.map_name,
        usageCount,
      });
    }

    const targetMapName = `isolated-${id}`;
    const cloned = await cloneMapWithLevels(game.map_name, {
      targetMapName,
      allowExistingTarget: true,
    });

    const updated = await updateGameMapName(id, cloned.mapName);
    if (!updated) {
      return NextResponse.json({ error: "Failed to rebind game map" }, { status: 500 });
    }

    logger(
      "Isolated game %s from map %s to %s (levels cloned: %d, reusedTarget: %s)",
      id,
      game.map_name,
      cloned.mapName,
      cloned.levelsCloned,
      cloned.reusedExistingTarget,
    );

    return NextResponse.json({
      isolated: true,
      previousMapName: game.map_name,
      mapName: cloned.mapName,
      usageCountBefore: usageCount,
      levelsCloned: cloned.levelsCloned,
      reusedExistingTarget: cloned.reusedExistingTarget,
    });
  } catch (error: unknown) {
    logger("Error isolating game map: %O", error);
    const message = error instanceof Error ? error.message : "Failed to isolate game map";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
