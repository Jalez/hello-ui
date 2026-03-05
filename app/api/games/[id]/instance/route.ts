import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getSql } from "@/app/api/_lib/db";
import { getGameById } from "@/app/api/_lib/services/gameService";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";

function getRows(result: any): any[] {
  return result?.rows ?? result ?? [];
}

async function resolveInstance(
  request: NextRequest,
  gameId: string,
  actorUserId: string,
  mode: "individual" | "group",
) {
  const sql = await getSql();

  if (mode === "group") {
    const groupId = request.nextUrl.searchParams.get("groupId");
    if (!groupId) {
      return { error: "groupId is required for group mode", status: 400 } as const;
    }

    const membershipResult = await sql.query(
      "SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1",
      [groupId, actorUserId],
    );
    const membershipRows = getRows(membershipResult);
    if (!membershipRows.length) {
      return { error: "You are not a member of this group", status: 403 } as const;
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

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const actorUser = await getOrCreateUserByEmail(session.user.email);

  const game = await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (!game.can_edit && !game.is_public) {
    return NextResponse.json({ error: "No access to this game" }, { status: 403 });
  }

  const mode = game.collaboration_mode === "group" ? "group" : "individual";
  const resolved = await resolveInstance(request, id, actorUser.id, mode);
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

  let body: any = {};
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

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const actorIdentifiers = [session.userId, session.user.email].filter(Boolean) as string[];
  const actorUser = await getOrCreateUserByEmail(session.user.email);

  const game = await getGameById(id, actorIdentifiers);
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const mode = game.collaboration_mode === "group" ? "group" : "individual";
  const resolved = await resolveInstance(request, id, actorUser.id, mode);
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
