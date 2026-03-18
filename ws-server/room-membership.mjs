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
  const logger = deps.logger || console;

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
      flushWriteBuffer(roomId, { force: true, reason: "last-user-left" }).finally(() => {
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

  const outDelayMs = deps.artificialDelayMs ?? 0;
  const outJitterMs = deps.artificialJitterMs ?? 0;
  const maxBufferedAmountBytes = deps.maxBufferedAmountBytes ?? (2 * 1024 * 1024);
  const transportStats = deps.transportStats || null;

  function guardSlowConsumer(socket) {
    const bufferedAmount = Number.isFinite(socket?.bufferedAmount) ? socket.bufferedAmount : 0;
    transportStats?.recordPeakBufferedAmount(bufferedAmount);
    if (bufferedAmount <= maxBufferedAmountBytes) {
      return false;
    }
    if (transportStats) {
      transportStats.recordSlowConsumer({
        socketId: getConnectionId(socket),
        roomId: getConnectionState(socket)?.roomId || null,
        bufferedAmount,
        limit: maxBufferedAmountBytes,
      });
    } else {
      logger.warn(
        `[slow-consumer] socket=${getConnectionId(socket)} room=${getConnectionState(socket)?.roomId || "none"} bufferedAmount=${bufferedAmount} limit=${maxBufferedAmountBytes}`
      );
    }
    try {
      socket.close(1013, "Slow consumer");
    } catch {
      // Ignore close races if the socket is already gone.
    }
    return true;
  }

  function sendSerialized(socket, data) {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (guardSlowConsumer(socket)) {
      return;
    }

    try {
      socket.send(data, (error) => {
        if (!error) {
          return;
        }
        if (transportStats) {
          transportStats.recordSendError({
            socketId: getConnectionId(socket),
            roomId: getConnectionState(socket)?.roomId || null,
            error,
          });
        } else {
          logger.warn(
            `[socket:send-error] socket=${getConnectionId(socket)} room=${getConnectionState(socket)?.roomId || "none"} message=${error?.message || String(error)}`
          );
        }
        try {
          socket.close(1011, "Send error");
        } catch {
          // Ignore close races if the socket is already gone.
        }
      });
    } catch (error) {
      if (transportStats) {
        transportStats.recordSendThrow({
          socketId: getConnectionId(socket),
          roomId: getConnectionState(socket)?.roomId || null,
          error,
        });
      } else {
        logger.warn(
          `[socket:send-throw] socket=${getConnectionId(socket)} room=${getConnectionState(socket)?.roomId || "none"} message=${error?.message || String(error)}`
        );
      }
      try {
        socket.close(1011, "Send error");
      } catch {
        // Ignore close races if the socket is already gone.
      }
    }
  }

  function sendMessage(socket, type, payload) {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const data = JSON.stringify({ type, payload, ts: Date.now() });
    if (outDelayMs <= 0 && outJitterMs <= 0) {
      sendSerialized(socket, data);
      return;
    }
    const jitter = outJitterMs > 0 ? Math.floor(Math.random() * outJitterMs) : 0;
    setTimeout(() => {
      sendSerialized(socket, data);
    }, outDelayMs + jitter);
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
