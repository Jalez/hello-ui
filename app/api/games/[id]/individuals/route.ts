import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/app/api/_lib/db";
import { getGameById } from "@/app/api/_lib/services/gameService";
import { getRows } from "@/app/api/games/[id]/instance/route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const { id: gameId } = await params;
  const game = await getGameById(gameId, actorIdentifiers);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (!game.can_edit) {
    return NextResponse.json({ error: "No access to this game" }, { status: 403 });
  }

  const sql = await getSql();
  const result = await sql.query(
    `SELECT
       gi.id AS instance_id,
       gi.user_id,
       gi.created_at,
       gi.updated_at,
       COALESCE(NULLIF(TRIM(u.name), ''), u.email) AS display_name,
       u.email AS user_email
     FROM game_instances gi
     LEFT JOIN users u ON u.id = gi.user_id
     WHERE gi.game_id = $1
       AND gi.scope = 'individual'
       AND gi.user_id IS NOT NULL
     ORDER BY gi.updated_at DESC`,
    [gameId],
  );

  const rows = getRows(result);
  return NextResponse.json({
    individuals: rows.map((row: Record<string, unknown>) => ({
      instanceId: String(row.instance_id),
      userId: String(row.user_id),
      displayName: row.display_name ? String(row.display_name) : null,
      userEmail: row.user_email ? String(row.user_email) : null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    })),
  });
}
