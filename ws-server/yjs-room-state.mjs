export function createYjsRoomStateService({
  editorTypes,
  roomYDocs,
  roomYDocGenerations,
  roomAwarenessStates,
  roomAwarenessConnections,
  roomEditorState,
  sendMessage,
  broadcastToRoom,
  extractGroupIdFromRoomId,
  markRoomDirty,
  awarenessProtocol,
  encoding,
  syncProtocol,
  Y,
  WebSocket,
}) {
  function isYjsEnabled() {
    return true;
  }

  function decodeBase64Update(value) {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  function encodeYjsProtocolPayload(encoder) {
    return Buffer.from(encoding.toUint8Array(encoder)).toString("base64");
  }

  function getRoomYDocGeneration(roomId) {
    return roomYDocGenerations.get(roomId) || 0;
  }

  function destroyRoomYResources(roomId) {
    roomYDocs.get(roomId)?.destroy();
    roomYDocs.delete(roomId);
    roomYDocGenerations.delete(roomId);
    roomAwarenessStates.get(roomId)?.destroy();
    roomAwarenessStates.delete(roomId);
    roomAwarenessConnections.delete(roomId);
  }

  function sendYjsProtocol(socket, roomId, channel, encoder) {
    if (encoding.length(encoder) === 0) {
      return;
    }
    sendMessage(socket, "yjs-protocol", {
      roomId,
      groupId: extractGroupIdFromRoomId(roomId),
      channel,
      payloadBase64: encodeYjsProtocolPayload(encoder),
      ts: Date.now(),
    });
  }

  function broadcastYjsProtocol(roomId, channel, encoder, excludeSocket = null) {
    if (encoding.length(encoder) === 0) {
      return;
    }
    broadcastToRoom(roomId, "yjs-protocol", {
      roomId,
      groupId: extractGroupIdFromRoomId(roomId),
      channel,
      payloadBase64: encodeYjsProtocolPayload(encoder),
      ts: Date.now(),
    }, excludeSocket);
  }

  function getYTextKey(editorType, levelIndex) {
    return `level:${levelIndex}:${editorType}`;
  }

  function hydrateYDocFromState(doc, state) {
    doc.transact(() => {
      state.levels.forEach((level, levelIndex) => {
        for (const editorType of editorTypes) {
          const text = doc.getText(getYTextKey(editorType, levelIndex));
          const nextValue = typeof level?.code?.[editorType] === "string" ? level.code[editorType] : "";
          if (text.toString() === nextValue) {
            continue;
          }
          text.delete(0, text.length);
          text.insert(0, nextValue);
        }
      });
    }, "hydrate-room-state");
  }

  function createRoomYDoc(roomId, state, generation = Math.max(getRoomYDocGeneration(roomId), 1)) {
    const existing = roomYDocs.get(roomId);
    if (existing) {
      destroyRoomYResources(roomId);
    }

    const doc = new Y.Doc();
    hydrateYDocFromState(doc, state);
    roomYDocs.set(roomId, doc);
    roomYDocGenerations.set(roomId, generation);
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);
    roomAwarenessStates.set(roomId, awareness);
    roomAwarenessConnections.set(roomId, new Map());

    doc.on("update", (update, origin) => {
      const roomState = roomEditorState.get(roomId);
      if (!roomState?.ctx) {
        return;
      }
      markRoomDirty(roomId, roomState.ctx);
      const encoder = encoding.createEncoder();
      syncProtocol.writeUpdate(encoder, update);
      broadcastYjsProtocol(roomId, "sync", encoder, origin instanceof WebSocket ? origin : null);
    });

    awareness.on("update", ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated, removed);
      if (changedClients.length === 0) {
        return;
      }

      if (origin instanceof WebSocket) {
        const roomConnections = roomAwarenessConnections.get(roomId);
        if (roomConnections) {
          const controlledIds = roomConnections.get(origin) || new Set();
          roomConnections.set(origin, controlledIds);
          added.forEach((clientId) => controlledIds.add(clientId));
          updated.forEach((clientId) => controlledIds.add(clientId));
          removed.forEach((clientId) => controlledIds.delete(clientId));
        }
      }

      const encoder = encoding.createEncoder();
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
      broadcastYjsProtocol(roomId, "awareness", encoder, origin instanceof WebSocket ? origin : null);
    });

    return doc;
  }

  function getOrCreateYDoc(roomId, state) {
    const existing = roomYDocs.get(roomId);
    if (existing) {
      return existing;
    }
    return createRoomYDoc(roomId, state);
  }

  function getOrCreateYAwareness(roomId, state) {
    getOrCreateYDoc(roomId, state);
    return roomAwarenessStates.get(roomId) || null;
  }

  function applyYjsAwarenessUpdate(roomId, state, update, socket) {
    const awareness = getOrCreateYAwareness(roomId, state);
    if (!awareness) {
      return;
    }
    awarenessProtocol.applyAwarenessUpdate(awareness, update, socket);
  }

  function cleanupSocketAwareness(roomId, socket) {
    const awareness = roomAwarenessStates.get(roomId);
    const roomConnections = roomAwarenessConnections.get(roomId);
    if (!awareness || !roomConnections) {
      return;
    }
    const controlledIds = roomConnections.get(socket);
    if (controlledIds && controlledIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(awareness, Array.from(controlledIds), null);
    }
    roomConnections.delete(socket);
  }

  function syncStateFromYDoc(roomId, state) {
    const doc = roomYDocs.get(roomId);
    if (!doc) {
      return;
    }
    state.levels.forEach((level, levelIndex) => {
      for (const editorType of editorTypes) {
        level.code[editorType] = doc.getText(getYTextKey(editorType, levelIndex)).toString();
      }
    });
  }

  function sendFullAwarenessState(socket, roomId, state) {
    const awareness = getOrCreateYAwareness(roomId, state);
    if (!awareness) {
      return;
    }
    const clients = Array.from(awareness.getStates().keys());
    if (clients.length === 0) {
      return;
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, clients));
    sendYjsProtocol(socket, roomId, "awareness", encoder);
  }

  return {
    isYjsEnabled,
    decodeBase64Update,
    getRoomYDocGeneration,
    sendYjsProtocol,
    broadcastYjsProtocol,
    createRoomYDoc,
    getOrCreateYDoc,
    getOrCreateYAwareness,
    applyYjsAwarenessUpdate,
    cleanupSocketAwareness,
    destroyRoomYResources,
    syncStateFromYDoc,
    sendFullAwarenessState,
  };
}
