import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getCreatorStatistics } from "@/app/api/_lib/services/gameStatisticsService";
import { getGameById } from "@/app/api/_lib/services/gameService";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const actorIdentifiers = session?.user?.email
    ? ([session.userId, session.user.email].filter(Boolean) as string[])
    : [];

  if (!actorIdentifiers.length) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const game = await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (!game.can_edit && !game.is_owner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const statistics = await getCreatorStatistics(id);
  return NextResponse.json({ participants: statistics.participants });
}
