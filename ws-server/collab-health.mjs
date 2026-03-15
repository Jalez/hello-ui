export function createCollabHealthService({
  roomClientStateHashes,
  roomDivergenceState,
  extractGroupIdFromRoomId,
  clientHashTtlMs,
  divergencePersistMs,
  divergenceRepeatThreshold,
  divergenceResyncCooldownMs,
  broadcastToRoom,
  ensureRoomState,
  parseRoomContext,
  serializeRoomStateSync,
  getOrCreateYDoc,
  broadcastYjsProtocol,
  syncProtocol,
  encoding,
}) {
  function getRoomClientHashes(roomId) {
    if (!roomClientStateHashes.has(roomId)) {
      roomClientStateHashes.set(roomId, new Map());
    }
    return roomClientStateHashes.get(roomId);
  }

  function pruneRoomClientHashes(roomId, now = Date.now()) {
    const reports = roomClientStateHashes.get(roomId);
    if (!reports) {
      return;
    }
    for (const [clientId, report] of reports.entries()) {
      if (now - report.receivedAt > clientHashTtlMs) {
        reports.delete(clientId);
      }
    }
    if (reports.size === 0) {
      roomClientStateHashes.delete(roomId);
    }
  }

  function removeClientStateHash(roomId, clientId) {
    if (!roomId || !clientId) {
      return;
    }
    const reports = roomClientStateHashes.get(roomId);
    if (!reports) {
      return;
    }
    reports.delete(clientId);
    if (reports.size === 0) {
      roomClientStateHashes.delete(roomId);
    }
  }

  function buildDivergenceKey(roomId, editorType, levelIndex) {
    return `${roomId}:${levelIndex}:${editorType}`;
  }

  function summarizeHashReports(reports) {
    return reports.map((report) => ({
      clientId: report.clientId,
      userId: report.userId,
      userEmail: report.userEmail,
      engine: report.engine,
      contentHash: report.contentHash,
      contentLength: report.contentLength,
      version: report.version ?? null,
      isFocused: Boolean(report.isFocused),
      isEditable: Boolean(report.isEditable),
      isTyping: Boolean(report.isTyping),
      ageMs: Date.now() - report.receivedAt,
    }));
  }

  function createCollaborationHealthMessage(roomId, eventType, severity, details = {}, scope = {}) {
    return {
      roomId,
      groupId: extractGroupIdFromRoomId(roomId),
      eventType,
      severity,
      editorType: scope.editorType,
      levelIndex: scope.levelIndex,
      details,
      ts: Date.now(),
    };
  }

  async function forceRoomResync(roomId, editorType, levelIndex, reason) {
    const ctx = parseRoomContext(roomId);
    if (!ctx) {
      return;
    }
    const state = await ensureRoomState(roomId, ctx);
    broadcastToRoom(roomId, "room-state-sync", serializeRoomStateSync(roomId, state));
    const doc = getOrCreateYDoc(roomId, state);
    if (doc) {
      const encoder = encoding.createEncoder();
      syncProtocol.writeSyncStep2(encoder, doc);
      broadcastYjsProtocol(roomId, "sync", encoder);
    }
    console.warn(
      `[divergence:resync] room=${roomId} editorType=${editorType} levelIndex=${levelIndex} reason=${reason}`
    );
  }

  async function evaluateClientStateHashes(roomId, report) {
    const now = Date.now();
    pruneRoomClientHashes(roomId, now);
    const reports = Array.from(getRoomClientHashes(roomId).values()).filter((candidate) =>
      candidate.editorType === report.editorType
      && candidate.levelIndex === report.levelIndex
      && now - candidate.receivedAt <= clientHashTtlMs
    );

    const divergenceKey = buildDivergenceKey(roomId, report.editorType, report.levelIndex);
    if (reports.length < 2) {
      roomDivergenceState.delete(divergenceKey);
      return;
    }

    const uniqueHashes = [...new Set(reports.map((candidate) => candidate.contentHash))];
    if (uniqueHashes.length <= 1) {
      roomDivergenceState.delete(divergenceKey);
      return;
    }

    const quietWindowSatisfied = reports.every((candidate) => {
      const localInputAgeMs = Number.isFinite(candidate.localInputAgeMs) ? candidate.localInputAgeMs : null;
      const remoteApplyAgeMs = Number.isFinite(candidate.remoteApplyAgeMs) ? candidate.remoteApplyAgeMs : null;
      return (
        (localInputAgeMs == null || localInputAgeMs >= divergencePersistMs)
        && (remoteApplyAgeMs == null || remoteApplyAgeMs >= divergencePersistMs)
      );
    });

    const signature = uniqueHashes.sort().join("|");
    const previous = roomDivergenceState.get(divergenceKey) || {
      firstDetectedAt: now,
      lastDetectedAt: now,
      lastSignature: signature,
      repeatCount: 0,
      lastResyncAt: 0,
    };

    const nextState =
      previous.lastSignature === signature
        ? {
            ...previous,
            lastDetectedAt: now,
            repeatCount: previous.repeatCount + 1,
          }
        : {
            ...previous,
            firstDetectedAt: now,
            lastDetectedAt: now,
            lastSignature: signature,
            repeatCount: 1,
          };

    roomDivergenceState.set(divergenceKey, nextState);

    if (!quietWindowSatisfied) {
      console.info(
        `[divergence:transient] room=${roomId} editorType=${report.editorType} levelIndex=${report.levelIndex} signature=${signature}`
      );
      return;
    }

    if (
      nextState.repeatCount < divergenceRepeatThreshold
      && now - nextState.firstDetectedAt < divergencePersistMs
    ) {
      return;
    }

    const summary = summarizeHashReports(reports);
    console.warn(
      `[divergence:detected] room=${roomId} editorType=${report.editorType} levelIndex=${report.levelIndex} hashes=${JSON.stringify(summary)}`
    );
    broadcastToRoom(roomId, "collaboration-health", createCollaborationHealthMessage(
      roomId,
      "divergence_detected",
      "error",
      {
        participants: summary,
        hashCount: uniqueHashes.length,
        quietWindowSatisfied,
      },
      {
        editorType: report.editorType,
        levelIndex: report.levelIndex,
      },
    ));

    if (now - nextState.lastResyncAt >= divergenceResyncCooldownMs) {
      nextState.lastResyncAt = now;
      roomDivergenceState.set(divergenceKey, nextState);
      await forceRoomResync(roomId, report.editorType, report.levelIndex, "client_hash_mismatch");
    }
  }

  return {
    getRoomClientHashes,
    removeClientStateHash,
    evaluateClientStateHashes,
  };
}
