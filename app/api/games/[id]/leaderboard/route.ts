import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import { getLeaderboardForGame } from "@/app/api/_lib/services/gameStatisticsService";
import { getGameByIdForGameplay } from "@/app/api/_lib/services/gameService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const actorIdentifiers = session?.user?.email
    ? ([session.userId, session.user.email].filter(Boolean) as string[])
    : [];

  const game = await getGameByIdForGameplay(id, actorIdentifiers.length ? actorIdentifiers : undefined);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  let actorUserId: string | null = null;
  if (session?.user?.email) {
    actorUserId = (await getOrCreateUserByEmail(session.user.email)).id;
  } else {
    actorUserId = request.nextUrl.searchParams.get("guestId");
  }

  const leaderboard = await getLeaderboardForGame(id, actorUserId);
  return NextResponse.json({
    ...leaderboard,
    canResetLeaderboard: Boolean(session?.user?.email && game.can_edit),
  });
}
