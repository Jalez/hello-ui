import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getGameById } from "@/app/api/_lib/services/gameService";

export function getWsAdminUrl(): string {
  const explicit = process.env.WS_SERVER_HTTP_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const configuredWsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  if (configuredWsUrl) {
    return configuredWsUrl
      .replace(/^ws:\/\//, "http://")
      .replace(/^wss:\/\//, "https://")
      .replace(/\/$/, "");
  }

  return "http://localhost:3100";
}

export async function requireCreatorGameAccess(gameId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: { message: "Authentication required", status: 401 } as const };
  }

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const game = await getGameById(gameId, actorIdentifiers);
  if (!game) {
    return { error: { message: "Game not found", status: 404 } as const };
  }

  if (!game.can_edit) {
    return { error: { message: "No access to this game", status: 403 } as const };
  }

  return { session, game };
}
