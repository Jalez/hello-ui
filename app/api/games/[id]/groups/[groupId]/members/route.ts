import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, ilike, inArray, notInArray, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { groupMembers, users } from "@/lib/db/schema";
import { getSql } from "@/app/api/_lib/db";
import { getRows } from "@/app/api/games/[id]/instance/route";
import { addGroupMember, getGroupById, removeGroupMember } from "@/app/api/_lib/services/groupService";
import { requireCreatorGameAccess } from "../../_shared";

async function getActiveGroupIdsForGame(gameId: string): Promise<string[]> {
  const sql = await getSql();
  const rows = getRows(
    await sql.query(
      `SELECT DISTINCT group_id
       FROM game_instances
       WHERE game_id = $1
         AND scope = 'group'
         AND group_id IS NOT NULL`,
      [gameId],
    ),
  );
  return rows.map((row: Record<string, unknown>) => String(row.group_id));
}

async function resolveUserByIdentifier(identifier: string) {
  const normalized = identifier.trim();
  if (!normalized) {
    return null;
  }

  const db = getDb();
  const emailMatches = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
    })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (emailMatches[0]) {
    return emailMatches[0];
  }

  const nameMatches = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
    })
    .from(users)
    .where(eq(users.name, normalized))
    .limit(2);

  if (nameMatches.length > 1) {
    throw new Error("Multiple users match that name. Use an email address instead.");
  }

  return nameMatches[0] ?? null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const { id: gameId, groupId } = await params;
  const access = await requireCreatorGameAccess(gameId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error.message }, { status: access.error.status });
  }

  const group = await getGroupById(groupId);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const identifier = typeof body.identifier === "string" ? body.identifier : "";
  if (!identifier.trim()) {
    return NextResponse.json({ error: "Email or name is required" }, { status: 400 });
  }

  try {
    const user = await resolveUserByIdentifier(identifier);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const activeGroupIds = await getActiveGroupIdsForGame(gameId);
    const sourceGroupIds = activeGroupIds.filter((id) => id !== groupId);
    if (sourceGroupIds.length > 0) {
      const db = getDb();
      await db
        .delete(groupMembers)
        .where(and(inArray(groupMembers.groupId, sourceGroupIds), eq(groupMembers.userId, user.id)));
    }

    await addGroupMember({
      groupId,
      userId: user.id,
      role: "member",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add user to group" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const { id: gameId, groupId } = await params;
  const access = await requireCreatorGameAccess(gameId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error.message }, { status: access.error.status });
  }

  const group = await getGroupById(groupId);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const userId = request.nextUrl.searchParams.get("userId") || "";
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  await removeGroupMember(groupId, userId);
  return NextResponse.json({ success: true });
}

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 10;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  const { id: gameId, groupId } = await params;
  const access = await requireCreatorGameAccess(gameId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error.message }, { status: access.error.status });
  }

  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  const db = getDb();
  const existingMemberRows = await db
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  const existingUserIds = existingMemberRows.map((row) => row.userId);

  const pattern = `%${q}%`;
  const baseWhere = or(ilike(users.email, pattern), ilike(users.name, pattern));
  const whereClause = existingUserIds.length > 0
    ? and(baseWhere, notInArray(users.id, existingUserIds))
    : baseWhere;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(whereClause)
    .orderBy(asc(users.email))
    .limit(MAX_RESULTS);

  const suggestions = rows
    .filter((row) => !existingUserIds.includes(row.id))
    .map((row) => ({
      userId: row.id,
      email: row.email,
      name: row.name,
      label: row.name ? `${row.name} (${row.email})` : row.email,
    }));

  return NextResponse.json({ suggestions });
}
