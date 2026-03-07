import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/app/api/_lib/db";
import { extractRows } from "@/app/api/_lib/db/shared";
import { getGameById } from "@/app/api/_lib/services/gameService";

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

  const sql = await getSql();
  const result = await sql.query(
    "DELETE FROM game_instances WHERE game_id = $1 RETURNING id",
    [id],
  );

  const deletedCount = extractRows(result).length;

  return NextResponse.json({
    gameId: id,
    deletedCount,
    message: deletedCount > 0 ? "Game instances reset." : "No game instances to reset.",
  });
}
