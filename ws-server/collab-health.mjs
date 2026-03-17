import { logCollaborationStep } from "./log-collaboration-step.mjs";

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
  serializeCodeLevels,
  advanceRoomYDocGeneration,
  getOrCreateYDoc,
  broadcastYjsProtocol,
  syncProtocol,
  encoding,
}) {
  /**
   * COLLABORATION STEP 17.4:
   * Get the hash-report bucket for one room, creating it on demand so divergence
   * checks always have somewhere to store the latest client snapshots.
   */
  function getRoomClientHashes(roomId) {
    logCollaborationStep("17.4", "getRoomClientHashes", {
      roomId,
    });
    if (!roomClientStateHashes.has(roomId)) {
      roomClientStateHashes.set(roomId, new Map());
    }
    return roomClientStateHashes.get(roomId);
  }

  /**
   * COLLABORATION STEP 17.5:
   * Drop stale client hash reports so divergence checks only compare recent editor
   * state instead of old sessions that are no longer relevant.
   */
  function pruneRoomClientHashes(roomId, now = Date.now()) {
    logCollaborationStep("17.5", "pruneRoomClientHashes", {
      roomId,
      now,
    });
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

  /**
   * COLLABORATION STEP 19.8:
   * Remove one departing client's last known hash report during disconnect cleanup.
   */
  function removeClientStateHash(roomId, clientId) {
    logCollaborationStep("19.8", "removeClientStateHash", {
      roomId,
      clientId,
    });
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

  /**
   * COLLABORATION STEP 17.6:
   * Build a unique identifier for divergence tracking of one editor in one level.
   */
  function buildDivergenceKey(roomId, editorType, levelIndex) {
    logCollaborationStep("17.6", "buildDivergenceKey", {
      roomId,
      editorType,
      levelIndex,
    });
    return `${roomId}:${levelIndex}:${editorType}`;
  }

  /**
   * COLLABORATION STEP 17.7:
   * Turn raw client hash reports into a readable summary for logs and health events.
   */
  function summarizeHashReports(reports) {
    logCollaborationStep("17.7", "summarizeHashReports", {
      count: reports.length,
    });
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

  /**
   * COLLABORATION STEP 17.8:
   * Shape one server-originated health message that can be broadcast back to clients.
   */
  function createCollaborationHealthMessage(roomId, eventType, severity, details = {}, scope = {}) {
    logCollaborationStep("17.8", "createCollaborationHealthMessage", {
      roomId,
      eventType,
      severity,
    });
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

  /**
   * COLLABORATION STEP 18.3:
   * Trigger a recovery broadcast when the server is convinced clients diverged:
   * resend room state and restart the Yjs sync response so everyone can converge.
   */
  async function forceRoomResync(roomId, editorType, levelIndex, reason) {
    logCollaborationStep("18.3", "forceRoomResync", {
      roomId,
      editorType,
      levelIndex,
      reason,
    });
    const ctx = parseRoomContext(roomId);
    if (!ctx) {
      return;
    }
    const state = await ensureRoomState(roomId, ctx);
    advanceRoomYDocGeneration(roomId);
    const roomStateSync = serializeRoomStateSync(roomId, state);
    const codeLevels = serializeCodeLevels(roomId, state);
    let forceReplaceYjsSyncPayloadBase64;
    const doc = getOrCreateYDoc(roomId, state);
    if (doc) {
      const encoder = encoding.createEncoder();
      syncProtocol.writeSyncStep2(encoder, doc);
      forceReplaceYjsSyncPayloadBase64 = Buffer.from(encoding.toUint8Array(encoder)).toString("base64");
      broadcastYjsProtocol(roomId, "sync", encoder);
    }
    broadcastToRoom(roomId, "room-state-sync", {
      ...roomStateSync,
      levels: Array.isArray(codeLevels?.levels) ? codeLevels.levels : roomStateSync.levels,
      ...(codeLevels?.groupStartGate ? { groupStartGate: codeLevels.groupStartGate } : {}),
      // Escalation path: when repeated divergence is confirmed, clients should
      // rebuild from the server snapshot even if the Yjs generation did not change.
      forceReplaceYDoc: true,
      ...(forceReplaceYjsSyncPayloadBase64
        ? { forceReplaceYjsSyncPayloadBase64 }
        : {}),
    });
    console.warn(
      `[divergence:resync] room=${roomId} editorType=${editorType} levelIndex=${levelIndex} reason=${reason}`
    );
  }

  /**
   * COLLABORATION STEP 17.9:
   * Compare recent client content fingerprints for the same editor. If multiple
   * collaborators disagree after a quiet window, mark it as real divergence and
   * escalate to recovery.
   */
  async function evaluateClientStateHashes(roomId, report) {
    logCollaborationStep("17.9", "evaluateClientStateHashes", {
      roomId,
      editorType: report.editorType,
      levelIndex: report.levelIndex,
    });
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
