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
       gi.group_id,
       gi.id AS instance_id,
       gi.created_at,
       gi.updated_at,
       g.name AS group_name,
       COALESCE(
         array_agg(COALESCE(NULLIF(TRIM(u.name), ''), u.email) ORDER BY gm.joined_at)
           FILTER (WHERE u.id IS NOT NULL),
         ARRAY[]::text[]
       ) AS member_names
     FROM game_instances gi
     INNER JOIN groups g ON g.id = gi.group_id
     LEFT JOIN group_members gm ON gm.group_id = gi.group_id
     LEFT JOIN users u ON u.id = gm.user_id
     WHERE gi.game_id = $1
       AND gi.scope = 'group'
       AND gi.group_id IS NOT NULL
     GROUP BY gi.group_id, gi.id, gi.created_at, gi.updated_at, g.name
     ORDER BY gi.updated_at DESC`,
    [gameId],
  );

  const rows = getRows(result);
  return NextResponse.json({
    groups: rows.map((row: Record<string, unknown>) => ({
      groupId: String(row.group_id),
      instanceId: String(row.instance_id),
      name: String(row.group_name),
      memberNames: Array.isArray(row.member_names)
        ? row.member_names.map((value) => String(value))
        : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}
