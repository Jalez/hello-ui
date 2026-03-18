import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import { logCollaborationStep } from "../log-collaboration-step.mjs";
import { isLobbyRoom, parseRoomContext } from "../room-context.mjs";

/**
 * @typedef {import("../ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */

function buildUserLeftPayload(userData) {
  return {
    clientId: userData.clientId,
    userId: userData.userId,
    userEmail: userData.userEmail,
    userName: userData.userName,
  };
}

export function removeSocketSession({
  socket,
  roomId,
  socketId = null,
  ctx,
  excludeSocket = socket,
  snapshotReason = null,
  snapshotExtra = {},
}) {
  const userData = ctx.removeUserFromRoom(roomId, socket);
  ctx.setConnectionState(socket, { roomId: null });

  if (!userData) {
    return null;
  }

  ctx.cleanupSocketAwareness(roomId, socket);
  ctx.removeClientStateHash(roomId, userData.clientId);
  ctx.broadcastToRoom(roomId, "user-left", buildUserLeftPayload(userData), excludeSocket);

  if (snapshotReason) {
    ctx.logRoomSnapshot(snapshotReason, roomId, {
      ...(socketId ? { by: socketId } : {}),
      ...snapshotExtra,
    });
  }

  return userData;
}

/**
 * COLLABORATION STEP 8.12:
 * Admit a websocket client into the room. This server step validates identity,
 * prevents forbidden duplicate sessions, loads the room snapshot, and sends back
 * the first state and Yjs handshake packets that boot the collaborative session.
 */
async function handleJoinGame({ socket, data, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("8.12", "handleJoinGame", {
    socketId,
    requestedRoomId: data?.roomId ?? data?.groupId ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);

  ctx.setConnectionState(socket, { roomId });
  const sessionRole = data.sessionRole === "readonly" ? "readonly" : "active";
  const baseUserData = {
    clientId: data.clientId || socketId,
    userId: data.userId || "",
    userEmail: data.userEmail || "",
    userName: data.userName || undefined,
    userImage: data.userImage || undefined,
    accountUserId: data.userId || "",
    accountUserEmail: data.userEmail || "",
    sessionRole,
  };
  // Only one ACTIVE session per account is allowed per room.
  // Read-only sessions may coexist so users can observe changes without taking control.
  const staleSockets = [];
  for (const [existingSocket, existingUser] of ctx.getRoomUsers(roomId).entries()) {
    if (existingSocket === socket) continue;
    const sameAccount =
      (baseUserData.userId && existingUser.accountUserId && existingUser.accountUserId === baseUserData.userId) ||
      (baseUserData.userEmail && existingUser.accountUserEmail && existingUser.accountUserEmail === baseUserData.userEmail);
    const existingRole = existingUser?.sessionRole === "readonly" ? "readonly" : "active";
    if (sameAccount && sessionRole === "active" && existingRole === "active") {
      staleSockets.push(existingSocket);
    }
  }
  for (const staleSocket of staleSockets) {
    const evictedData = removeSocketSession({
      socket: staleSocket,
      roomId,
      ctx,
      excludeSocket: staleSocket,
    });
    if (evictedData) {
      console.log(`[join-game:evict] user=${evictedData.userEmail} room=${roomId} reason=same-account-active-rejoin`);
    }
    try { staleSocket.close(4009, "Replaced by new session"); } catch { /* already closed */ }
  }

  // Duplicates are always allowed; we assign a distinct identity per room when needed.
  const resolvedIdentity = ctx.resolveDuplicateIdentity(roomId, baseUserData);
  const userData = {
    ...baseUserData,
    userId: resolvedIdentity.effectiveUserId,
    userName: resolvedIdentity.effectiveUserName,
    duplicateIndex: resolvedIdentity.duplicateIndex,
  };
  ctx.addUserToRoom(roomId, socket, userData);

  ctx.broadcastToRoom(roomId, "user-joined", userData, socket);

  const currentUsers = Array.from(ctx.getRoomUsers(roomId).values());
  ctx.sendMessage(socket, "current-users", { users: currentUsers });
  ctx.sendMessage(socket, "identity-assigned", {
    roomId,
    userId: userData.userId,
    userEmail: userData.userEmail,
    userName: userData.userName,
    userImage: userData.userImage,
    accountUserId: userData.accountUserId,
    accountUserEmail: userData.accountUserEmail,
    duplicateIndex: userData.duplicateIndex || 0,
    ts: Date.now(),
  });

  if (roomCtx) {
    const state = await ctx.ensureRoomState(roomId, roomCtx);
    ctx.sendMessage(socket, "room-state-sync", ctx.serializeRoomStateSync(roomId, state));
    const groupStartSync = ctx.serializeGroupStartSync(roomId, state);
    if (groupStartSync) {
      ctx.sendMessage(socket, "group-start-sync", groupStartSync);
    }
    if (ctx.isYjsEnabled()) {
      const doc = ctx.getOrCreateYDoc(roomId, state);
      const snapshotEncoder = encoding.createEncoder();
      syncProtocol.writeSyncStep2(snapshotEncoder, doc);
      ctx.sendYjsProtocol(socket, roomId, "sync", snapshotEncoder);

      const handshakeEncoder = encoding.createEncoder();
      syncProtocol.writeSyncStep1(handshakeEncoder, doc);
      ctx.sendYjsProtocol(socket, roomId, "sync", handshakeEncoder);

      // Send current awareness states so the joining client sees existing users immediately
      ctx.sendFullAwarenessState(socket, roomId, state);
    }
    console.log(`[room-state-sync:emit] room=${roomId} target=${socketId} levelsCount=${state.levels.length}`);
  } else if (isLobbyRoom(roomId)) {
    const lobbyState = ctx.ensureLobbyState(roomId);
    ctx.sendMessage(socket, "lobby-chat-sync", {
      roomId,
      messages: lobbyState.messages,
      ts: Date.now(),
    });
  } else {
    console.log(`[room-state-sync:skip] room=${roomId} target=${socketId} reason=invalid-room-context`);
  }

  console.log(`[join-game] user=${userData.userEmail} room=${roomId} total=${currentUsers.length}`);
  ctx.logRoomSnapshot("join", roomId, { by: socketId });
}

/**
 * COLLABORATION STEP 19.5:
 * Remove a socket from the room and clean up everything tied to that session,
 * including awareness state and client hash tracking.
 */
async function handleLeaveGame({ socket, data, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("19.5", "handleLeaveGame", {
    socketId,
    requestedRoomId: data?.roomId ?? data?.groupId ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const userData = removeSocketSession({
    socket,
    roomId,
    socketId,
    ctx,
    snapshotReason: "leave",
  });
  if (userData) {
    console.log(`[leave-game] user=${userData.userEmail} room=${roomId}`);
  }
}

export const sessionHandlers = {
  "join-game": handleJoinGame,
  "leave-game": handleLeaveGame,
};
