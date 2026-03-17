import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import { logCollaborationStep } from "../log-collaboration-step.mjs";
import { extractGameIdFromRoomId, isLobbyRoom, parseRoomContext } from "../room-context.mjs";

/**
 * @typedef {import("../ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */

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
  const gameId = extractGameIdFromRoomId(roomId);

  ctx.setConnectionState(socket, { roomId });
  const baseUserData = {
    clientId: data.clientId || socketId,
    userId: data.userId || "",
    userEmail: data.userEmail || "",
    userName: data.userName || undefined,
    userImage: data.userImage || undefined,
    accountUserId: data.userId || "",
    accountUserEmail: data.userEmail || "",
  };
  // Evict stale sockets from the same account in the same room (e.g. page refresh).
  // This must happen before duplicate detection so the old session doesn't block or
  // rename the new one. Collect first to avoid mutating the Map during iteration.
  const staleSockets = [];
  for (const [existingSocket, existingUser] of ctx.getRoomUsers(roomId).entries()) {
    if (existingSocket === socket) continue;
    const sameAccount =
      (baseUserData.userId && existingUser.accountUserId && existingUser.accountUserId === baseUserData.userId) ||
      (baseUserData.userEmail && existingUser.accountUserEmail && existingUser.accountUserEmail === baseUserData.userEmail);
    if (sameAccount) {
      staleSockets.push(existingSocket);
    }
  }
  for (const staleSocket of staleSockets) {
    const evictedData = ctx.removeUserFromRoom(roomId, staleSocket);
    if (evictedData) {
      ctx.cleanupSocketAwareness(roomId, staleSocket);
      ctx.removeClientStateHash(roomId, evictedData.clientId);
      ctx.broadcastToRoom(roomId, "user-left", {
        clientId: evictedData.clientId,
        userId: evictedData.userId,
        userEmail: evictedData.userEmail,
        userName: evictedData.userName,
      }, staleSocket);
      console.log(`[join-game:evict-stale] user=${evictedData.userEmail} room=${roomId} reason=same-account-rejoin`);
    }
    try { staleSocket.close(4009, "Replaced by new session"); } catch { /* already closed */ }
  }

  const existingDuplicates = ctx.findDuplicateUsersInGame(gameId, baseUserData, roomId);
  if (gameId && existingDuplicates.length > 0 && !await ctx.isDuplicateUserAllowed(gameId)) {
    const conflictingUser = existingDuplicates[0];
    const attemptedLabel = baseUserData.userName || baseUserData.userEmail || "this account";
    const attemptedEmail = baseUserData.userEmail ? ` (${baseUserData.userEmail})` : "";
    const conflictingLabel = conflictingUser.userName || conflictingUser.userEmail || "this account";
    const conflictingEmail = conflictingUser.userEmail ? ` (${conflictingUser.userEmail})` : "";
    const summarizeIdentity = (label, email) => {
      const combined = `${label}${email}`;
      return combined.length > 40 ? `${combined.slice(0, 37)}...` : combined;
    };
    const attemptedSummary = summarizeIdentity(attemptedLabel, attemptedEmail);
    const conflictingSummary = summarizeIdentity(conflictingLabel, conflictingEmail);
    const duplicateError =
      `This browser is being identified as ${JSON.stringify(`${attemptedLabel}${attemptedEmail}`)}, ` +
      `but ${JSON.stringify(`${conflictingLabel}${conflictingEmail}`)} is already connected in this game. ` +
      `Ask the creator to enable duplicate users in Game Settings, or turn group submission off from the A+ navbar setting. ` +
      `Allowing duplicates may cause instability and desyncs in group mode.`;
    const duplicateCloseReason =
      `Identified as ${attemptedSummary}; ${conflictingSummary} is already connected.`;
    ctx.sendMessage(socket, "error", {
      error: duplicateError,
      code: "duplicate_users_blocked",
      roomId,
      ts: Date.now(),
    });
    setTimeout(() => {
      try {
        socket.close(4008, duplicateCloseReason);
      } catch {
        // Ignore close races if the socket is already gone.
      }
    }, 50);
    return;
  }
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

  const userData = ctx.removeUserFromRoom(roomId, socket);
  ctx.setConnectionState(socket, { roomId: null });

  if (userData) {
    ctx.cleanupSocketAwareness(roomId, socket);
    ctx.removeClientStateHash(roomId, userData.clientId);
    ctx.broadcastToRoom(
      roomId,
      "user-left",
      {
        clientId: userData.clientId,
        userId: userData.userId,
        userEmail: userData.userEmail,
        userName: userData.userName,
      },
      socket
    );
    console.log(`[leave-game] user=${userData.userEmail} room=${roomId}`);
    ctx.logRoomSnapshot("leave", roomId, { by: socketId });
  }
}

export const sessionHandlers = {
  "join-game": handleJoinGame,
  "leave-game": handleLeaveGame,
};
