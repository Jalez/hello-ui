import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import { getSql } from "@/app/api/_lib/db";
import { getLtiSession } from "@/lib/lti";
import { resolveAplusAppGroup } from "@/app/api/_lib/services/ltiGroupResolver";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ltiSession = await getLtiSession();
    if (!ltiSession?.ltiData?.resource_link_id) {
      return NextResponse.json({ error: "LTI session not available" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const rawLmsGroupId = typeof body?.lmsGroupId === "string" || typeof body?.lmsGroupId === "number"
      ? String(body.lmsGroupId).trim()
      : "";
    const { id: gameId } = await params;

    if (!rawLmsGroupId || rawLmsGroupId === "0") {
      return NextResponse.json({ error: "Invalid LMS group id" }, { status: 400 });
    }

    const currentUser = await getOrCreateUserByEmail(session.user.email);
    const sql = await getSql();
    const resolvedGroup = await resolveAplusAppGroup({
      sql,
      resourceLinkId: ltiSession.ltiData.resource_link_id || gameId,
      contextTitle: ltiSession.ltiData.context_title || null,
      aplusGroup: rawLmsGroupId,
      userId: currentUser.id,
      role: ltiSession.role || "member",
    });

    return NextResponse.json(resolvedGroup);
  } catch (error) {
    console.error("[lti-group-resolve]", error);
    return NextResponse.json({ error: "Failed to resolve LMS group" }, { status: 500 });
  }
}
