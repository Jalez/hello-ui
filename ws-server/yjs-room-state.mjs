import { logCollaborationStep } from "./log-collaboration-step.mjs";

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
  /**
   * COLLABORATION STEP 8.6:
   * Feature flag helper for the server's Yjs-backed code sync path.
   */
  function isYjsEnabled() {
    logCollaborationStep("8.6", "isYjsEnabled");
    return true;
  }

  /**
   * COLLABORATION STEP 9.1:
   * Turn a transport-safe base64 packet back into raw Yjs bytes so the server can
   * actually apply the collaboration update.
   */
  function decodeBase64Update(value) {
    logCollaborationStep("9.1", "decodeBase64Update", {
      payloadLength: value.length,
    });
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  /**
   * COLLABORATION STEP 10.1:
   * Convert raw Yjs protocol bytes into base64 before broadcasting them back over
   * websocket transport.
   */
  function encodeYjsProtocolPayload(encoder) {
    logCollaborationStep("10.1", "encodeYjsProtocolPayload", {
      byteLength: encoding.length(encoder),
    });
    return Buffer.from(encoding.toUint8Array(encoder)).toString("base64");
  }

  /**
   * COLLABORATION STEP 8.7:
   * Read the current Yjs document generation so clients know whether they should
   * keep using their local shared doc or rebuild it.
   */
  function getRoomYDocGeneration(roomId) {
    logCollaborationStep("8.7", "getRoomYDocGeneration", {
      roomId,
    });
    return roomYDocGenerations.get(roomId) || 0;
  }

  /**
   * COLLABORATION STEP 8.7A:
   * Advance the room's Yjs generation marker without rebuilding the server doc so
   * clients can reject stale packets that were already in flight.
   */
  function advanceRoomYDocGeneration(roomId) {
    const nextGeneration = Math.max(getRoomYDocGeneration(roomId) + 1, 1);
    roomYDocGenerations.set(roomId, nextGeneration);
    return nextGeneration;
  }

  /**
   * COLLABORATION STEP 19.6:
   * Dispose of the shared Yjs document and awareness objects for a room once they
   * are no longer needed.
   */
  function destroyRoomYResources(roomId) {
    logCollaborationStep("19.6", "destroyRoomYResources", {
      roomId,
    });
    roomYDocs.get(roomId)?.destroy();
    roomYDocs.delete(roomId);
    roomYDocGenerations.delete(roomId);
    roomAwarenessStates.get(roomId)?.destroy();
    roomAwarenessStates.delete(roomId);
    roomAwarenessConnections.delete(roomId);
  }

  /**
   * COLLABORATION STEP 10.2:
   * Send one Yjs sync or awareness response to a single socket.
   */
  function sendYjsProtocol(socket, roomId, channel, encoder) {
    logCollaborationStep("10.2", "sendYjsProtocol", {
      roomId,
      channel,
    });
    if (encoding.length(encoder) === 0) {
      return;
    }
    sendMessage(socket, "yjs-protocol", {
      roomId,
      groupId: extractGroupIdFromRoomId(roomId),
      channel,
      payloadBase64: encodeYjsProtocolPayload(encoder),
      yjsDocGeneration: getRoomYDocGeneration(roomId),
      ts: Date.now(),
    });
  }

  /**
   * COLLABORATION STEP 10.3:
   * Broadcast one Yjs sync or awareness packet to the rest of the room after the
   * shared document or presence map has changed.
   */
  function broadcastYjsProtocol(roomId, channel, encoder, excludeSocket = null) {
    logCollaborationStep("10.3", "broadcastYjsProtocol", {
      roomId,
      channel,
      excluded: Boolean(excludeSocket),
    });
    if (encoding.length(encoder) === 0) {
      return;
    }
    broadcastToRoom(roomId, "yjs-protocol", {
      roomId,
      groupId: extractGroupIdFromRoomId(roomId),
      channel,
      payloadBase64: encodeYjsProtocolPayload(encoder),
      yjsDocGeneration: getRoomYDocGeneration(roomId),
      ts: Date.now(),
    }, excludeSocket);
  }

  /**
   * COLLABORATION STEP 8.8:
   * Build the room-wide key for a specific editor and level inside the shared Yjs doc.
   */
  function getYTextKey(editorType, levelIndex) {
    logCollaborationStep("8.8", "getYTextKey", {
      editorType,
      levelIndex,
    });
    return `level:${levelIndex}:${editorType}`;
  }

  function getYSolutionTextKey(editorType, levelIndex) {
    logCollaborationStep("8.8", "getYSolutionTextKey", {
      editorType,
      levelIndex,
    });
    return `level:${levelIndex}:solution:${editorType}`;
  }

  /**
   * COLLABORATION STEP 8.9:
   * Copy the persisted room code into a fresh Yjs document so the CRDT starts from
   * the same content the room snapshot already knows about.
   */
  function hydrateYDocFromState(doc, state) {
    logCollaborationStep("8.9", "hydrateYDocFromState", {
      levelsCount: state.levels.length,
    });
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

        // Creator rooms: hydrate solution editors from persisted level.solution.
        if (state?.ctx?.kind === "creator") {
          const metaSolution =
            level?.meta?.solution && typeof level.meta.solution === "object" && !Array.isArray(level.meta.solution)
              ? level.meta.solution
              : null;
          for (const editorType of editorTypes) {
            const text = doc.getText(getYSolutionTextKey(editorType, levelIndex));
            const nextValue = metaSolution && typeof metaSolution?.[editorType] === "string" ? metaSolution[editorType] : "";
            if (text.toString() === nextValue) {
              continue;
            }
            text.delete(0, text.length);
            text.insert(0, nextValue);
          }
        }
      });
    }, "hydrate-room-state");
  }

  /**
   * COLLABORATION STEP 8.10:
   * Create the shared Yjs document and awareness map for one room, then wire the
   * listeners that rebroadcast changes and mark the room dirty for persistence.
   */
  function createRoomYDoc(roomId, state, generation = Math.max(getRoomYDocGeneration(roomId), 1)) {
    logCollaborationStep("8.10", "createRoomYDoc", {
      roomId,
      generation,
      levelsCount: state.levels.length,
    });
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

  /**
   * COLLABORATION STEP 8.11:
   * Reuse an existing room document when possible, or lazily create it on the
   * first collaboration message that needs shared code state.
   */
  function getOrCreateYDoc(roomId, state) {
    logCollaborationStep("8.11", "getOrCreateYDoc", {
      roomId,
      hasExisting: roomYDocs.has(roomId),
    });
    const existing = roomYDocs.get(roomId);
    if (existing) {
      return existing;
    }
    return createRoomYDoc(roomId, state);
  }

  /**
   * COLLABORATION STEP 9.3:
   * Ensure the room's awareness map exists before applying or reading presence.
   */
  function getOrCreateYAwareness(roomId, state) {
    logCollaborationStep("9.3", "getOrCreateYAwareness", {
      roomId,
    });
    getOrCreateYDoc(roomId, state);
    return roomAwarenessStates.get(roomId) || null;
  }

  /**
   * COLLABORATION STEP 9.4:
   * Apply one client's latest presence packet into the room-wide awareness map so
   * selections, active tabs, and typing indicators stay shared.
   */
  function applyYjsAwarenessUpdate(roomId, state, update, socket) {
    logCollaborationStep("9.4", "applyYjsAwarenessUpdate", {
      roomId,
      updateLength: update.length,
    });
    const awareness = getOrCreateYAwareness(roomId, state);
    if (!awareness) {
      return;
    }
    awarenessProtocol.applyAwarenessUpdate(awareness, update, socket);
  }

  /**
   * COLLABORATION STEP 19.7:
   * Remove any awareness entries that belonged to a disconnected socket so remote
   * users do not keep seeing stale cursors or typing indicators.
   */
  function cleanupSocketAwareness(roomId, socket) {
    logCollaborationStep("19.7", "cleanupSocketAwareness", {
      roomId,
    });
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

  /**
   * COLLABORATION STEP 11.2:
   * Copy the latest CRDT text back into the plain room state object right before
   * serialization or persistence.
   */
  function syncStateFromYDoc(roomId, state) {
    logCollaborationStep("11.2", "syncStateFromYDoc", {
      roomId,
      levelsCount: state.levels.length,
    });
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

  /**
   * COLLABORATION STEP 8.14:
   * Send the full current awareness snapshot to a newly joined client so they
   * instantly see who is present and where people are editing.
   */
  function sendFullAwarenessState(socket, roomId, state) {
    logCollaborationStep("8.14", "sendFullAwarenessState", {
      roomId,
      levelsCount: state.levels.length,
    });
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
    advanceRoomYDocGeneration,
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
