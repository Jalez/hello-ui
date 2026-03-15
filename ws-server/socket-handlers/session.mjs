import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import { extractGameIdFromRoomId, isLobbyRoom, parseRoomContext } from "../room-context.mjs";

/**
 * @typedef {import("../ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */

async function handleJoinGame({ socket, data, socketId, resolveRoomId, ctx }) {
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
  const existingDuplicates = ctx.findDuplicateUsersInGame(gameId, baseUserData);
  if (gameId && existingDuplicates.length > 0 && !await ctx.isDuplicateGroupUserAllowed(gameId)) {
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
      `Turn group submission off from the A+ navbar setting, or ask the creator to enable duplicate users in Game Settings. ` +
      `Allowing duplicates may cause instability and desyncs.`;
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

async function handleLeaveGame({ socket, data, socketId, resolveRoomId, ctx }) {
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const userData = ctx.removeUserFromRoom(roomId, socket);
  ctx.setConnectionState(socket, { roomId: null });

  if (userData) {
    ctx.broadcastToRoom(
      roomId,
      "user-left",
      {
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
