import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/app/api/_lib/db";
import { evaluateGameRouteAccess, getGameById, getGameByIdForGameplay } from "@/app/api/_lib/services/gameService";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import {
  attachGameAccessCookie,
  clearGameAccessCookie,
  getRawAccessKeyFromRequest,
  resolveAccessKeyForGame,
} from "@/app/api/_lib/services/gameService/accessCookie";

export function getRows(result: { rows?: unknown[] } | unknown[] | null | undefined): Record<string, unknown>[] {
  if (!result) {
    return [];
  }

  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }

  return (result.rows ?? []) as Record<string, unknown>[];
}

export function getAccessKeyFromRequest(request: NextRequest): string | null {
  return getRawAccessKeyFromRequest(request);
}

export function accessDenied(reason: "not_started" | "expired" | "access_key_required" | "access_key_invalid") {
  if (reason === "not_started") {
    return NextResponse.json({ error: "Game is not open yet", reason }, { status: 403 });
  }
  if (reason === "expired") {
    return NextResponse.json({ error: "Game access window has ended", reason }, { status: 403 });
  }
  return NextResponse.json(
    {
      error: reason === "access_key_invalid" ? "Invalid access key" : "Access key required",
      reason,
      requiresAccessKey: true,
    },
    { status: 403 },
  );
}

export function shouldEnforceAccess(request: NextRequest): boolean {
  return request.nextUrl.searchParams.get("accessContext") === "game";
}

async function resolveGroupInstance(sql: Awaited<ReturnType<typeof getSql>>, gameId: string, groupId: string) {
  const existingResult = await sql.query(
    "SELECT id, progress_data FROM game_instances WHERE game_id = $1 AND scope = 'group' AND group_id = $2 LIMIT 1",
    [gameId, groupId],
  );
  const existingRows = getRows(existingResult);
  if (existingRows.length) {
    return {
      instance: {
        id: existingRows[0].id,
        scope: "group" as const,
        groupId,
        userId: null,
        progressData: existingRows[0].progress_data ?? {},
      },
    } as const;
  }

  const createdResult = await sql.query(
    `INSERT INTO game_instances (game_id, scope, group_id, progress_data)
     VALUES ($1, 'group', $2, '{}')
     RETURNING id, progress_data`,
    [gameId, groupId],
  );
  const createdRows = getRows(createdResult);
  return {
    instance: {
      id: createdRows[0].id,
      scope: "group" as const,
      groupId,
      userId: null,
      progressData: createdRows[0].progress_data ?? {},
    },
  } as const;
}

async function resolveIndividualInstance(sql: Awaited<ReturnType<typeof getSql>>, gameId: string, actorUserId: string) {
  const existingResult = await sql.query(
    "SELECT id, progress_data FROM game_instances WHERE game_id = $1 AND scope = 'individual' AND user_id = $2 LIMIT 1",
    [gameId, actorUserId],
  );
  const existingRows = getRows(existingResult);
  if (existingRows.length) {
    return {
      instance: {
        id: existingRows[0].id,
        scope: "individual" as const,
        groupId: null,
        userId: actorUserId,
        progressData: existingRows[0].progress_data ?? {},
      },
    } as const;
  }

  const createdResult = await sql.query(
    `INSERT INTO game_instances (game_id, scope, user_id, progress_data)
     VALUES ($1, 'individual', $2, '{}')
     RETURNING id, progress_data`,
    [gameId, actorUserId],
  );
  const createdRows = getRows(createdResult);
  return {
    instance: {
      id: createdRows[0].id,
      scope: "individual" as const,
      groupId: null,
      userId: actorUserId,
      progressData: createdRows[0].progress_data ?? {},
    },
  } as const;
}

export async function resolveInstance(
  request: NextRequest,
  gameId: string,
  actorUserId: string,
  mode: "individual" | "group",
  canEditGame: boolean = false,
) {
  const sql = await getSql();

  if (mode === "group") {
    const groupId = request.nextUrl.searchParams.get("groupId");
    if (!groupId) {
      if (canEditGame) {
        return resolveIndividualInstance(sql, gameId, actorUserId);
      }
      return { error: "groupId is required for group mode", status: 400 } as const;
    }

    if (canEditGame) {
      const groupResult = await sql.query("SELECT id FROM groups WHERE id = $1 LIMIT 1", [groupId]);
      const groupRows = getRows(groupResult);
      if (!groupRows.length) {
        return { error: "Group not found", status: 404 } as const;
      }
    } else {
      const membershipResult = await sql.query(
        "SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1",
        [groupId, actorUserId],
      );
      const membershipRows = getRows(membershipResult);
      if (!membershipRows.length) {
        return { error: "You are not a member of this group", status: 403 } as const;
      }
    }

    return resolveGroupInstance(sql, gameId, groupId);
  }

  return resolveIndividualInstance(sql, gameId, actorUserId);
}

async function resolveServiceTokenAuth(request: NextRequest, gameId: string) {
  const serviceToken = request.headers.get("x-ws-service-token");
  if (!serviceToken || serviceToken !== process.env.WS_SERVICE_TOKEN) {
    return null;
  }

  const groupId = request.nextUrl.searchParams.get("groupId");
  const userId = request.nextUrl.searchParams.get("userId");

  const sql = await getSql();

  // Look up the game directly (no actor-based access check for service calls)
  const gameResult = await sql.query(
    "SELECT id, collaboration_mode FROM projects WHERE id = $1 LIMIT 1",
    [gameId],
  );
  const gameRows = getRows(gameResult);
  if (!gameRows.length) {
    return { error: "Game not found", status: 404 } as const;
  }

  const mode = gameRows[0].collaboration_mode === "group" ? "group" : "individual";

  if (mode === "group") {
    if (!groupId) {
      return { error: "groupId is required for group mode", status: 400 } as const;
    }
    const existingResult = await sql.query(
      "SELECT id, progress_data FROM game_instances WHERE game_id = $1 AND scope = 'group' AND group_id = $2 LIMIT 1",
      [gameId, groupId],
    );
    const existingRows = getRows(existingResult);
    if (existingRows.length) {
      return {
        instance: {
          id: existingRows[0].id,
          scope: "group" as const,
          groupId,
          userId: null,
          progressData: existingRows[0].progress_data ?? {},
        },
        collaborationMode: mode,
      } as const;
    }
    const createdResult = await sql.query(
      `INSERT INTO game_instances (game_id, scope, group_id, progress_data)
       VALUES ($1, 'group', $2, '{}')
       RETURNING id, progress_data`,
      [gameId, groupId],
    );
    const createdRows = getRows(createdResult);
    return {
      instance: {
        id: createdRows[0].id,
        scope: "group" as const,
        groupId,
        userId: null,
        progressData: createdRows[0].progress_data ?? {},
      },
      collaborationMode: mode,
    } as const;
  }

  // Individual mode
  if (!userId) {
    return { error: "userId is required for individual mode", status: 400 } as const;
  }
  const existingResult = await sql.query(
    "SELECT id, progress_data FROM game_instances WHERE game_id = $1 AND scope = 'individual' AND user_id = $2 LIMIT 1",
    [gameId, userId],
  );
  const existingRows = getRows(existingResult);
  if (existingRows.length) {
    return {
      instance: {
        id: existingRows[0].id,
        scope: "individual" as const,
        groupId: null,
        userId,
        progressData: existingRows[0].progress_data ?? {},
      },
      collaborationMode: mode,
    } as const;
  }
  const createdResult = await sql.query(
    `INSERT INTO game_instances (game_id, scope, user_id, progress_data)
     VALUES ($1, 'individual', $2, '{}')
     RETURNING id, progress_data`,
    [gameId, userId],
  );
  const createdRows = getRows(createdResult);
  return {
    instance: {
      id: createdRows[0].id,
      scope: "individual" as const,
      groupId: null,
      userId,
      progressData: createdRows[0].progress_data ?? {},
    },
    collaborationMode: mode,
  } as const;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Service token auth (WS server calls)
  const serviceResult = await resolveServiceTokenAuth(request, id);
  if (serviceResult) {
    if ("error" in serviceResult) {
      return NextResponse.json({ error: serviceResult.error }, { status: serviceResult.status });
    }
    return NextResponse.json({
      gameId: id,
      collaborationMode: serviceResult.collaborationMode,
      instance: serviceResult.instance,
    });
  }

  const session = await getServerSession(authOptions);
  const enforceGameplayAccess = shouldEnforceAccess(request);
  const actorIdentifiers = session?.user?.email
    ? [session.userId, session.user.email].filter(Boolean) as string[]
    : [];
  if (!session?.user?.email && !enforceGameplayAccess) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const game = enforceGameplayAccess
    ? await getGameByIdForGameplay(id, actorIdentifiers.length ? actorIdentifiers : undefined)
    : await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (session?.user?.email && !game.can_edit && !game.is_public) {
    return NextResponse.json({ error: "No access to this game" }, { status: 403 });
  }

  if (enforceGameplayAccess) {
    const rawAccessKey = getRawAccessKeyFromRequest(request);
    const accessError = evaluateGameRouteAccess(game, resolveAccessKeyForGame(request, game));
    if (accessError) {
      const deniedResponse = accessDenied(accessError);
      if (accessError === "access_key_required" || accessError === "access_key_invalid") {
        clearGameAccessCookie(request, deniedResponse, game.id);
      }
      return deniedResponse;
    }

    const mode = game.collaboration_mode === "group" ? "group" : "individual";
    const actorUserId = session?.user?.email
      ? (await getOrCreateUserByEmail(session.user.email)).id
      : request.nextUrl.searchParams.get("guestId");
    if (!actorUserId) {
      return NextResponse.json({ error: "guestId is required for public individual games" }, { status: 400 });
    }
    if (!session?.user?.email && game.collaboration_mode === "group") {
      return NextResponse.json({ error: "Authentication required for group games" }, { status: 401 });
    }

    const resolved = await resolveInstance(request, id, actorUserId, mode, Boolean(game.can_edit));
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const response = NextResponse.json({
      gameId: id,
      collaborationMode: mode,
      instance: resolved.instance,
    });
    attachGameAccessCookie(request, response, game, rawAccessKey);
    return response;
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

  const resolved = await resolveInstance(request, id, actorUserId, mode, Boolean(game.can_edit));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  return NextResponse.json({
    gameId: id,
    collaborationMode: mode,
    instance: resolved.instance,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const progressData = body?.progressData;
  if (!progressData || typeof progressData !== "object" || Array.isArray(progressData)) {
    return NextResponse.json({ error: "Invalid progressData payload" }, { status: 400 });
  }

  // Service token auth (WS server calls)
  const serviceResult = await resolveServiceTokenAuth(request, id);
  if (serviceResult) {
    if ("error" in serviceResult) {
      return NextResponse.json({ error: serviceResult.error }, { status: serviceResult.status });
    }

    const sql = await getSql();
    const updatedResult = await sql.query(
      "UPDATE game_instances SET progress_data = $2, updated_at = NOW() WHERE id = $1 RETURNING id, progress_data",
      [serviceResult.instance.id, progressData],
    );
    const updatedRows = getRows(updatedResult);

    return NextResponse.json({
      gameId: id,
      collaborationMode: serviceResult.collaborationMode,
      instance: {
        ...serviceResult.instance,
        progressData: updatedRows[0]?.progress_data ?? progressData,
      },
    });
  }

  const session = await getServerSession(authOptions);
  const enforceGameplayAccess = shouldEnforceAccess(request);
  const actorIdentifiers = session?.user?.email
    ? [session.userId, session.user.email].filter(Boolean) as string[]
    : [];
  if (!session?.user?.email && !enforceGameplayAccess) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const game = enforceGameplayAccess
    ? await getGameByIdForGameplay(id, actorIdentifiers.length ? actorIdentifiers : undefined)
    : await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (enforceGameplayAccess) {
    const rawAccessKey = getRawAccessKeyFromRequest(request);
    const accessError = evaluateGameRouteAccess(game, resolveAccessKeyForGame(request, game));
    if (accessError) {
      const deniedResponse = accessDenied(accessError);
      if (accessError === "access_key_required" || accessError === "access_key_invalid") {
        clearGameAccessCookie(request, deniedResponse, game.id);
      }
      return deniedResponse;
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

    const resolved = await resolveInstance(request, id, actorUserId, mode, Boolean(game.can_edit));
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const sql = await getSql();
    const updatedResult = await sql.query(
      "UPDATE game_instances SET progress_data = $2, updated_at = NOW() WHERE id = $1 RETURNING id, progress_data",
      [resolved.instance.id, progressData],
    );
    const updatedRows = getRows(updatedResult);

    const response = NextResponse.json({
      gameId: id,
      collaborationMode: mode,
      instance: {
        ...resolved.instance,
        progressData: updatedRows[0]?.progress_data ?? progressData,
      },
    });
    attachGameAccessCookie(request, response, game, rawAccessKey);
    return response;
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

  const resolved = await resolveInstance(request, id, actorUserId, mode, Boolean(game.can_edit));
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const sql = await getSql();
  const updatedResult = await sql.query(
    "UPDATE game_instances SET progress_data = $2, updated_at = NOW() WHERE id = $1 RETURNING id, progress_data",
    [resolved.instance.id, progressData],
  );
  const updatedRows = getRows(updatedResult);

  return NextResponse.json({
    gameId: id,
    collaborationMode: mode,
    instance: {
      ...resolved.instance,
      progressData: updatedRows[0]?.progress_data ?? progressData,
    },
  });
}
