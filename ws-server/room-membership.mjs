export function createRoomMembership(deps) {
  const {
    rooms,
    connectionState,
    roomLobbyState,
    roomEditorState,
    roomYDocs,
    roomYDocGenerations,
    roomAwarenessStates,
    roomAwarenessConnections,
    roomClientStateHashes,
    roomDivergenceState,
    roomWriteBuffer,
    flushWriteBuffer,
    parseRoomContext,
    randomUUID,
    WebSocket,
  } = deps;

  function getRoomUsers(roomId) {
    return rooms.get(roomId) || new Map();
  }

  function clearRoomMemory(roomId) {
    roomEditorState.delete(roomId);
    roomLobbyState.delete(roomId);
    roomYDocs.get(roomId)?.destroy();
    roomYDocs.delete(roomId);
    roomYDocGenerations.delete(roomId);
    roomAwarenessStates.get(roomId)?.destroy();
    roomAwarenessStates.delete(roomId);
    roomAwarenessConnections.delete(roomId);
    roomClientStateHashes.delete(roomId);
    if (roomDivergenceState) {
      for (const key of Array.from(roomDivergenceState.keys())) {
        if (key.startsWith(`${roomId}:`)) {
          roomDivergenceState.delete(key);
        }
      }
    }
  }

  function addUserToRoom(roomId, socket, userData) {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    rooms.get(roomId).set(socket, userData);
  }

  function removeUserFromRoom(roomId, socket) {
    const room = rooms.get(roomId);
    if (!room) return null;

    const userData = room.get(socket);
    room.delete(socket);

    if (room.size === 0) {
      console.log(`[room-empty] room=${roomId} trigger=last-user-left flushing=queued`);
      rooms.delete(roomId);
      flushWriteBuffer(roomId, { reason: "last-user-left" }).finally(() => {
        if (!rooms.has(roomId) && !roomWriteBuffer.has(roomId)) {
          clearRoomMemory(roomId);
        }
      });
    }

    return userData;
  }

  function ensureLobbyState(roomId) {
    if (!roomLobbyState.has(roomId)) {
      roomLobbyState.set(roomId, { messages: [] });
    }
    return roomLobbyState.get(roomId);
  }

  function setConnectionState(socket, nextState) {
    const current = connectionState.get(socket) || { id: randomUUID(), roomId: null };
    connectionState.set(socket, { ...current, ...nextState });
  }

  function getConnectionState(socket) {
    return connectionState.get(socket) || null;
  }

  function getConnectionId(socket) {
    return getConnectionState(socket)?.id || "unknown";
  }

  function summarizeRoomMembers(roomId) {
    return Array.from(getRoomUsers(roomId).values()).map((user) => ({
      userId: user.userId || "",
      accountUserId: user.accountUserId || "",
      accountUserEmail: user.accountUserEmail || "",
      userEmail: user.userEmail || "",
      userName: user.userName || "",
      userImage: user.userImage || "",
      clientId: user.clientId || "",
    }));
  }

  function logRoomSnapshot(reason, roomId, extra = {}) {
    const ctx = parseRoomContext(roomId);
    const state = roomEditorState.get(roomId);
    console.log(
      `[room-snapshot:${reason}] room=${roomId} gameId=${ctx?.gameId || "none"} groupId=${ctx?.groupId || "none"} instanceId=${state?.instanceId || "none"} roomUsers=${getRoomUsers(roomId).size} members=${JSON.stringify(summarizeRoomMembers(roomId))} extra=${JSON.stringify(extra)}`
    );
  }

  function sendMessage(socket, type, payload) {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify({ type, payload, ts: Date.now() }));
  }

  function broadcastToRoom(roomId, type, payload, excludeSocket = null) {
    const room = rooms.get(roomId);
    if (!room) {
      return;
    }

    for (const [socket] of room.entries()) {
      if (socket === excludeSocket) {
        continue;
      }
      sendMessage(socket, type, payload);
    }
  }

  return {
    getRoomUsers,
    clearRoomMemory,
    addUserToRoom,
    removeUserFromRoom,
    ensureLobbyState,
    setConnectionState,
    getConnectionState,
    getConnectionId,
    summarizeRoomMembers,
    logRoomSnapshot,
    sendMessage,
    broadcastToRoom,
  };
}
