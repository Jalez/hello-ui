import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSql } from "@/app/api/_lib/db";
import { getRows } from "@/app/api/games/[id]/instance/route";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getGroupById, getGroupMembers } from "@/app/api/_lib/services/groupService";
import { getWsAdminUrl, requireCreatorGameAccess } from "../_shared";

function getRoomId(gameId: string, groupId: string) {
  return `group:${groupId}:game:${gameId}`;
}

export async function GET(
  _request: NextRequest,
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

  const sql = await getSql();
  const [instanceRow] = getRows(
    await sql.query(
      `SELECT id, created_at, updated_at
       FROM game_instances
       WHERE game_id = $1
         AND group_id = $2
         AND scope = 'group'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [gameId, groupId],
    ),
  );

  const members = await getGroupMembers(groupId);
  const db = getDb();
  const memberProfiles = members.length === 0
    ? []
    : await Promise.all(
        members.map(async (member) => {
          const [profile] = await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              image: users.image,
            })
            .from(users)
            .where(eq(users.id, member.userId))
            .limit(1);

          return {
            ...member,
            userEmail: profile?.email ?? null,
            userName: profile?.name ?? null,
            userImage: profile?.image ?? null,
          };
        }),
      );

  let liveUsers: Array<{ userId?: string; userEmail?: string; userName?: string; clientId?: string }> = [];
  try {
    const wsResponse = await fetch(
      `${getWsAdminUrl()}/admin/room-members?roomId=${encodeURIComponent(getRoomId(gameId, groupId))}`,
      {
        headers: {
          "x-ws-service-token": process.env.WS_SERVICE_TOKEN || "",
        },
        cache: "no-store",
      },
    );
    if (wsResponse.ok) {
      const payload = await wsResponse.json().catch(() => ({}));
      liveUsers = Array.isArray(payload.members) ? payload.members : [];
    }
  } catch (error) {
    console.error("[group-details:live-users-error]", error);
  }

  const liveUserIds = new Set(liveUsers.map((entry) => String(entry.userId || "")).filter(Boolean));
  const liveUserEmails = new Set(liveUsers.map((entry) => String(entry.userEmail || "").toLowerCase()).filter(Boolean));

  const mergedMembers = memberProfiles.map((member) => ({
    ...member,
    isConnected:
      liveUserIds.has(member.userId) ||
      (member.userEmail ? liveUserEmails.has(member.userEmail.toLowerCase()) : false),
  }));

  const extraLiveUsers = liveUsers
    .filter((entry) => {
      const userId = String(entry.userId || "");
      const userEmail = String(entry.userEmail || "").toLowerCase();
      return !mergedMembers.some(
        (member) =>
          member.userId === userId ||
          (member.userEmail ? member.userEmail.toLowerCase() === userEmail : false),
      );
    })
    .map((entry) => ({
      userId: entry.userId || "",
      userEmail: entry.userEmail || null,
      userName: entry.userName || null,
      clientId: entry.clientId || "",
      isConnected: true,
    }));

  return NextResponse.json({
    group: {
      ...group,
      instanceId: instanceRow?.id ?? null,
      createdAt: instanceRow?.created_at ?? group.createdAt,
      updatedAt: instanceRow?.updated_at ?? group.updatedAt,
    },
    members: mergedMembers,
    extraLiveUsers,
  });
}
