import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getGameById } from "@/app/api/_lib/services/gameService";
import { resetLeaderboardForGame } from "@/app/api/_lib/services/gameStatisticsService";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  }

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const game = await getGameById(id, actorIdentifiers);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (!game.can_edit) {
    return NextResponse.json({ error: "No edit access for this game" }, { status: 403 });
  }

  const result = await resetLeaderboardForGame(id);

  return NextResponse.json({
    gameId: id,
    ...result,
    message:
      result.deletedAttempts > 0
        ? `Reset leaderboard data for ${result.deletedAttempts} attempt${result.deletedAttempts === 1 ? "" : "s"}.`
        : "No leaderboard data to reset.",
  });
}
