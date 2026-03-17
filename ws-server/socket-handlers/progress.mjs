import { logCollaborationStep } from "../log-collaboration-step.mjs";
import { extractGroupIdFromRoomId, parseRoomContext } from "../room-context.mjs";

/**
 * @typedef {import("../ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */

/**
 * COLLABORATION STEP 18.8:
 * Send one client a fresh room snapshot when it asks for recovery or suspects it
 * missed authoritative room metadata.
 */
async function handleRequestRoomStateSync({ socket, data, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("18.8", "handleRequestRoomStateSync", {
    socketId,
    reason: data?.reason ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);
  if (!roomCtx) {
    console.log(`[room-state-sync:skip] room=${roomId} target=${socketId} reason=invalid-room-context-request`);
    return;
  }

  const state = await ctx.ensureRoomState(roomId, roomCtx);
  ctx.sendMessage(socket, "room-state-sync", ctx.serializeRoomStateSync(roomId, state));
  const groupStartSync = ctx.serializeGroupStartSync(roomId, state);
  if (groupStartSync) {
    ctx.sendMessage(socket, "group-start-sync", groupStartSync);
  }
  console.log(
    `[room-state-sync:emit] room=${roomId} target=${socketId} reason=request levelsCount=${state.levels.length}`
  );
}

/**
 * COLLABORATION STEP 18.9:
 * Merge shared non-code progress data into the room state and rebroadcast it to
 * the rest of the group so room metadata stays aligned with the shared code.
 */
async function handleProgressSync({ socket, data, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("18.9", "handleProgressSync", {
    socketId,
    keys: Object.keys(data?.progressData ?? {}),
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);
  if (!roomCtx || roomCtx.kind !== "instance") {
    return;
  }

  const state = await ctx.ensureRoomState(roomId, roomCtx);
  const incomingProgress =
    data?.progressData && typeof data.progressData === "object" && !Array.isArray(data.progressData)
      ? data.progressData
      : null;
  if (!incomingProgress) {
    return;
  }

  if (ctx.isGroupInstanceContext(roomCtx) && "groupStartGate" in incomingProgress) {
    delete incomingProgress.groupStartGate;
  }

  state.progressData = {
    ...state.progressData,
    ...incomingProgress,
    levels: state.progressData.levels,
  };
  ctx.applyStartedGateToLevels(state);

  ctx.broadcastToRoom(roomId, "progress-sync", {
    progressData: incomingProgress,
    ts: Date.now(),
  }, socket);
  console.log(`[progress-sync] room=${roomId} from=${socketId} keys=${Object.keys(incomingProgress).join(",")}`);
  if (Array.isArray(state.progressData.levels) && Array.isArray(incomingProgress.levels)) {
    incomingProgress.levels.forEach((incomingLevel, levelIndex) => {
      const previousLevel = state.progressData.levels[levelIndex] || {};
      ["lockHTML", "lockCSS", "lockJS"].forEach((lockKey) => {
        if (typeof incomingLevel?.[lockKey] === "boolean" && incomingLevel[lockKey] !== previousLevel?.[lockKey]) {
          console.log(
            `[lock-state] room=${roomId} from=${socketId} gameId=${roomCtx.gameId} groupId=${roomCtx.groupId || "none"} instanceId=${state.instanceId || "none"} levelIndex=${levelIndex} key=${lockKey} prev=${Boolean(previousLevel?.[lockKey])} next=${Boolean(incomingLevel[lockKey])}`
          );
        }
      });
    });
  }
}

/**
 * COLLABORATION STEP 18.10:
 * Coordinate the "everyone is ready" gate for group play. This is adjacent to
 * code sync because it changes shared room state and can trigger a room resync.
 */
async function handleGroupStart({ socket, data, envelope, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("18.10", "handleGroupStart", {
    socketId,
    messageType: envelope.type,
    userId: data?.userId ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);
  if (!ctx.isGroupInstanceContext(roomCtx)) {
    return;
  }

  const userId = typeof data.userId === "string" ? data.userId : "";
  if (!userId) {
    return;
  }

  const state = await ctx.ensureRoomState(roomId, roomCtx);
  const gate = ctx.ensureGroupStartGate(state);
  if (!gate) {
    return;
  }

  if (gate.status === "started") {
    const startedSync = ctx.serializeGroupStartSync(roomId, state);
    if (startedSync) {
      ctx.sendMessage(socket, "group-start-sync", startedSync);
    }
    return;
  }

  if (envelope.type === "group-start-ready") {
    if (!gate.readyUserIds.includes(userId)) {
      gate.readyUserIds = [...gate.readyUserIds, userId];
    }
    gate.readyUsers = {
      ...gate.readyUsers,
      [userId]: {
        userId,
        ...(typeof data.userName === "string" ? { userName: data.userName } : {}),
        ...(typeof data.userEmail === "string" ? { userEmail: data.userEmail } : {}),
        ...(typeof data.userImage === "string" ? { userImage: data.userImage } : {}),
        readyAt: new Date().toISOString(),
      },
    };
  } else {
    gate.readyUserIds = gate.readyUserIds.filter((entry) => entry !== userId);
    const nextReadyUsers = { ...gate.readyUsers };
    delete nextReadyUsers[userId];
    gate.readyUsers = nextReadyUsers;
  }

  if (gate.readyUserIds.length >= gate.minReadyCount) {
    gate.status = "started";
    gate.startedAt = new Date().toISOString();
    gate.startedByUserId = userId;
    ctx.applyStartedGateToLevels(state);
    ctx.sendMessage(socket, "room-state-sync", ctx.serializeRoomStateSync(roomId, state));
    ctx.broadcastToRoom(roomId, "room-state-sync", ctx.serializeRoomStateSync(roomId, state), socket);
  }

  state.progressData = {
    ...state.progressData,
    groupStartGate: gate,
  };
  ctx.markRoomDirty(roomId, roomCtx);

  const syncPayload = ctx.serializeGroupStartSync(roomId, state);
  if (syncPayload) {
    ctx.sendMessage(socket, "group-start-sync", syncPayload);
    ctx.broadcastToRoom(roomId, "group-start-sync", syncPayload, socket);
  }

  ctx.broadcastToRoom(roomId, "progress-sync", {
    progressData: { groupStartGate: gate },
    ts: Date.now(),
  }, socket);
  ctx.sendMessage(socket, "progress-sync", {
    progressData: { groupStartGate: gate },
    ts: Date.now(),
  });
  console.log(
    `[group-start:${envelope.type === "group-start-ready" ? "ready" : "unready"}] room=${roomId} from=${socketId} userId=${userId} readyCount=${gate.readyUserIds.length}/${gate.minReadyCount} status=${gate.status}`
  );
  ctx.logRoomSnapshot(envelope.type === "group-start-ready" ? "start-ready" : "start-unready", roomId, {
    by: socketId,
    readyCount: gate.readyUserIds.length,
    status: gate.status,
  });
}

/**
 * COLLABORATION STEP 18.11:
 * Perform a hard reset of one level or the full game, rebuild the room's shared
 * Yjs document, persist the new baseline, and broadcast the reset to the room.
 */
async function handleResetRoomState({ socket, data, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("18.11", "handleResetRoomState", {
    socketId,
    scope: data?.scope ?? null,
    levelIndex: data?.levelIndex ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);
  if (!roomCtx || roomCtx.kind !== "instance") {
    return;
  }

  const room = ctx.rooms.get(roomId);
  const resetUser = room?.get(socket) || null;
  const scope = data?.scope === "game" ? "game" : "level";
  const levelIndex = Number.isInteger(data?.levelIndex) ? data.levelIndex : 0;
  const currentState = await ctx.ensureRoomState(roomId, roomCtx);
  console.log(
    `[room-state-reset:start] room=${roomId} by=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} scope=${scope} levelIndex=${levelIndex} levelsCount=${currentState.levels.length} mapName=${currentState.mapName || "none"}`
  );
  let templateLevels = currentState.mapName
    ? await ctx.fetchLevelsForMapName(currentState.mapName)
    : [];

  if (templateLevels.length === 0) {
    templateLevels = Array.isArray(currentState.templateLevels)
      ? currentState.templateLevels
      : [];
  }
  if (templateLevels.length === 0) {
    console.warn(
      `[room-state-reset:skip] room=${roomId} by=${socketId} reason=no-template-levels scope=${scope} levelIndex=${levelIndex}`
    );
    return;
  }

  const nextState = ctx.createRoomState(roomCtx, ctx.serializeProgressData(currentState), {
    templateLevels,
    mapName: currentState.mapName,
  });
  if (scope === "game") {
    nextState.levels = templateLevels.map((templateLevel) => ctx.createLevelState(templateLevel));
  } else {
    const templateLevel = templateLevels[levelIndex];
    if (!templateLevel) {
      return;
    }
    nextState.levels[levelIndex] = ctx.createLevelState(templateLevel);
  }
  ctx.applyStartedGateToLevels(nextState);
  ctx.roomEditorState.set(roomId, nextState);
  if (ctx.isYjsEnabled()) {
    const nextGeneration = Math.max(ctx.getRoomYDocGeneration(roomId) + 1, 1);
    ctx.createRoomYDoc(roomId, nextState, nextGeneration);
  }

  const existingBuffer = ctx.roomWriteBuffer.get(roomId);
  if (existingBuffer?.timer) {
    clearTimeout(existingBuffer.timer);
  }
  ctx.roomWriteBuffer.delete(roomId);

  const result = await ctx.saveProgressToDB(roomCtx, ctx.serializeCodeLevels(roomId, nextState));
  if (!result.ok && !result.permanentFailure) {
    ctx.markRoomDirty(roomId, roomCtx);
  }
  console.log(
    `[room-state-reset:save] room=${roomId} by=${socketId} ok=${result.ok} permanentFailure=${result.permanentFailure} dirty=${!result.ok && !result.permanentFailure} scope=${scope} levelIndex=${levelIndex}`
  );

  ctx.broadcastToRoom(roomId, "room-state-sync", ctx.serializeRoomStateSync(roomId, nextState));
  const groupStartSync = ctx.serializeGroupStartSync(roomId, nextState);
  if (groupStartSync) {
    ctx.broadcastToRoom(roomId, "group-start-sync", groupStartSync);
  }
  const resetNotice = {
    scope,
    levelIndex,
    userId: resetUser?.userId || (typeof data?.userId === "string" ? data.userId : ""),
    ...(typeof resetUser?.userName === "string" && resetUser.userName
      ? { userName: resetUser.userName }
      : {}),
    ...(typeof resetUser?.userEmail === "string" && resetUser.userEmail
      ? { userEmail: resetUser.userEmail }
      : {}),
    at: new Date().toISOString(),
  };
  ctx.broadcastToRoom(roomId, "progress-sync", {
    progressData: { resetNotice },
    ts: Date.now(),
  }, socket);
  console.log(`[room-state-sync:emit] room=${roomId} by=${socketId} reason=reset scope=${scope} levelIndex=${levelIndex}`);
}

export const progressHandlers = {
  "request-room-state-sync": handleRequestRoomStateSync,
  "progress-sync": handleProgressSync,
  "group-start-ready": handleGroupStart,
  "group-start-unready": handleGroupStart,
  "reset-room-state": handleResetRoomState,
};
