import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/app/api/_lib/db";
import { evaluateGameRouteAccess, getGameById, getGameByIdForGameplay } from "@/app/api/_lib/services/gameService";
import { resolveAccessKeyForGame } from "@/app/api/_lib/services/gameService/accessCookie";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import {
  accessDenied,
  getRows,
  resolveInstance,
  shouldEnforceAccess,
} from "../instance/route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params;

  let body: {
    points?: number;
    maxPoints?: number;
    pointsByLevel?: Record<string, { points?: number; maxPoints?: number; accuracy?: number; bestTime?: string; scenarios?: { scenarioId: string; accuracy: number }[] }>;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const points = typeof body.points === "number" ? body.points : 0;
  const maxPoints = typeof body.maxPoints === "number" ? body.maxPoints : 0;
  if (maxPoints <= 0) {
    return NextResponse.json({ error: "Invalid points: maxPoints must be positive" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const enforceGameplayAccess = shouldEnforceAccess(request);
  const actorIdentifiers = session?.user?.email
    ? ([session.userId, session.user.email].filter(Boolean) as string[])
    : [];
  if (!session?.user?.email && !enforceGameplayAccess) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const game = enforceGameplayAccess
    ? await getGameByIdForGameplay(gameId, actorIdentifiers.length ? actorIdentifiers : undefined)
    : await getGameById(gameId, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (session?.user?.email && !game.can_edit && !game.is_public) {
    return NextResponse.json({ error: "No access to this game" }, { status: 403 });
  }

  if (enforceGameplayAccess) {
    const isOwnerOrCollaborator = Boolean(session?.user?.email && (game.can_edit || game.is_owner));
    if (!isOwnerOrCollaborator) {
      const resolvedKey = resolveAccessKeyForGame(request, {
        id: game.id,
        access_key_required: game.access_key_required,
        access_key: game.access_key,
      });
      const accessError = evaluateGameRouteAccess(game, resolvedKey);
      if (accessError) {
        return accessDenied(accessError);
      }
    }
  }

  if (!session?.user?.email && game.collaboration_mode === "group") {
    return NextResponse.json({ error: "Authentication required for group games" }, { status: 401 });
  }

  const mode = game.collaboration_mode === "group" ? "group" : "individual";
  const actorUserId = session?.user?.email
    ? (await getOrCreateUserByEmail(session.user.email)).id
    : request.nextUrl.searchParams.get("guestId");
  if (!actorUserId) {
    return NextResponse.json({ error: "guestId is required for public individual games" }, { status: 400 });
  }

  const resolved = await resolveInstance(request, gameId, actorUserId, mode);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const existing = (resolved.instance.progressData || {}) as Record<string, unknown>;
  const progressData: Record<string, unknown> = {
    ...existing,
    finishedAt: new Date().toISOString(),
    finalScore: { points, maxPoints },
  };
  if (body.pointsByLevel && typeof body.pointsByLevel === "object" && !Array.isArray(body.pointsByLevel)) {
    progressData.pointsByLevel = body.pointsByLevel;
  }

  const sql = await getSql();
  const updatedResult = await sql.query(
    "UPDATE game_instances SET progress_data = $2, updated_at = NOW() WHERE id = $1 RETURNING id, progress_data",
    [resolved.instance.id, progressData]
  );
  const updatedRows = getRows(updatedResult);

  return NextResponse.json({
    success: true,
    instance: {
      ...resolved.instance,
      progressData: (updatedRows[0] as { progress_data?: Record<string, unknown> })?.progress_data ?? progressData,
    },
  });
}
