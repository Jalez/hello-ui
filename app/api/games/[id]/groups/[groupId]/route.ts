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

  let liveUsers: Array<{
    userId?: string;
    accountUserId?: string;
    userEmail?: string;
    accountUserEmail?: string;
    userName?: string;
    userImage?: string;
    clientId?: string;
  }> = [];
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

  const memberHasLiveSession = (member: typeof memberProfiles[number]) =>
    liveUsers.some((entry) => {
      const liveUserId = String(entry.userId || "");
      const liveAccountUserId = String(entry.accountUserId || "");
      const liveEmail = String(entry.userEmail || "").toLowerCase();
      const liveAccountEmail = String(entry.accountUserEmail || "").toLowerCase();
      const memberEmail = String(member.userEmail || "").toLowerCase();

      if (member.userId && (liveUserId === member.userId || liveAccountUserId === member.userId)) {
        return true;
      }

      if (!memberEmail) {
        return false;
      }

      return liveEmail === memberEmail || liveAccountEmail === memberEmail;
    });

  const mergedMembers = memberProfiles.map((member) => ({
    ...member,
    isConnected: memberHasLiveSession(member),
  }));

  const extraLiveUsers = liveUsers
    .filter((entry) => {
      const userId = String(entry.userId || "");
      const accountUserId = String(entry.accountUserId || "");
      return !mergedMembers.some(
        (member) => member.userId === userId || (!userId && accountUserId && member.userId === accountUserId),
      );
    })
    .map((entry) => ({
      userId: entry.userId || "",
      accountUserId: entry.accountUserId || "",
      userEmail: entry.userEmail || null,
      accountUserEmail: entry.accountUserEmail || null,
      userName: entry.userName || null,
      userImage: entry.userImage || null,
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
