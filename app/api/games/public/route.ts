import { NextResponse } from "next/server";
import { getPublicGames } from "@/app/api/_lib/services/gameService";
import { getLevelsForMap } from "@/app/api/_lib/services/mapService";
import debug from "debug";

const logger = debug("ui_designer:api:games:public");

function summarizeLanguages(levels: Array<{ json: Record<string, unknown> }>) {
  return levels.reduce(
    (acc, level) => {
      const levelJson = level.json ?? {};
      if (levelJson.lockHTML !== true) acc.html = true;
      if (levelJson.lockCSS !== true) acc.css = true;
      if (levelJson.lockJS !== true) acc.js = true;
      return acc;
    },
    { html: false, css: false, js: false }
  );
}

export async function GET() {
  try {
    const games = await getPublicGames();
    const gamesWithLanguages = await Promise.all(
      games.map(async (game) => {
        const levels = await getLevelsForMap(game.map_name);
        return {
          game,
          languages: summarizeLanguages(levels),
        };
      })
    );

    return NextResponse.json(
      gamesWithLanguages.map(({ game, languages }) => ({
        id: game.id,
        mapName: game.map_name,
        title: game.title,
        thumbnailUrl: game.thumbnail_url,
        shareToken: game.share_token,
        accessWindowEnabled: game.access_window_enabled,
        accessStartsAt: game.access_starts_at,
        accessEndsAt: game.access_ends_at,
        accessKeyRequired: game.access_key_required,
        collaborationMode: game.collaboration_mode,
        languages,
        createdAt: game.created_at,
        updatedAt: game.updated_at,
      })),
    );
  } catch (error: unknown) {
    logger("Error: %O", error);
    return NextResponse.json({ message: "Failed to fetch public games" }, { status: 500 });
  }
}
