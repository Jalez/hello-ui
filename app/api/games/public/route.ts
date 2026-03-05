import { NextResponse } from "next/server";
import { getPublicGames } from "@/app/api/_lib/services/gameService";
import debug from "debug";

const logger = debug("ui_designer:api:games:public");

export async function GET() {
  try {
    const games = await getPublicGames();
    return NextResponse.json(
      games.map((g) => ({
        id: g.id,
        mapName: g.map_name,
        title: g.title,
        thumbnailUrl: g.thumbnail_url,
        shareToken: g.share_token,
        accessWindowEnabled: g.access_window_enabled,
        accessStartsAt: g.access_starts_at,
        accessEndsAt: g.access_ends_at,
        accessKeyRequired: g.access_key_required,
        collaborationMode: g.collaboration_mode,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      })),
    );
  } catch (error: unknown) {
    logger("Error: %O", error);
    return NextResponse.json({ message: "Failed to fetch public games" }, { status: 500 });
  }
}

