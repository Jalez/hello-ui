function hashString(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createYjsTrafficMonitor(options = {}) {
  const {
    summaryIntervalMs = 10000,
    staleMetricsMs = 60000,
    awarenessSummaryThreshold = 5,
    awarenessRepeatThreshold = 30,
    awarenessRepeatWindowMs = 10000,
    syncBurstThreshold = 120,
    syncBurstWindowMs = 10000,
    logger = console,
    now = () => Date.now(),
  } = options;

  const roomMetrics = new Map();
  const awarenessMetrics = new Map();
  const syncMetrics = new Map();
  let lastPrunedAt = 0;

  function getRoomMetrics(roomId) {
    let metrics = roomMetrics.get(roomId);
    if (!metrics) {
      metrics = {
        lastSeenAt: 0,
        lastSummaryAt: now(),
        awarenessRecv: 0,
        syncRecv: 0,
        bytesIn: 0,
        connectedUsers: 0,
        syncMessageTypes: new Map(),
      };
      roomMetrics.set(roomId, metrics);
    }
    return metrics;
  }

  function maybeLogSummary(roomId, metrics, timestamp) {
    if (timestamp - metrics.lastSummaryAt < summaryIntervalMs) {
      return;
    }
    const shouldLogSummary =
      metrics.syncRecv > 0
      || metrics.awarenessRecv >= awarenessSummaryThreshold;
    if (!shouldLogSummary) {
      metrics.lastSummaryAt = timestamp;
      metrics.awarenessRecv = 0;
      metrics.syncRecv = 0;
      metrics.bytesIn = 0;
      metrics.syncMessageTypes.clear();
      return;
    }
    const syncTypes = Array.from(metrics.syncMessageTypes.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([messageType, count]) => `${messageType}:${count}`)
      .join(",");
    logger.log(
      `[yjs-traffic:summary] room=${roomId} awarenessRecv=${metrics.awarenessRecv} syncRecv=${metrics.syncRecv} ` +
      `syncTypes=${syncTypes || "none"} bytesIn=${metrics.bytesIn} connectedUsers=${metrics.connectedUsers}`
    );
    metrics.lastSummaryAt = timestamp;
    metrics.awarenessRecv = 0;
    metrics.syncRecv = 0;
    metrics.bytesIn = 0;
    metrics.syncMessageTypes.clear();
  }

  function maybePrune(timestamp) {
    if (timestamp - lastPrunedAt < staleMetricsMs) {
      return;
    }
    lastPrunedAt = timestamp;
    for (const [roomId, metrics] of roomMetrics.entries()) {
      if (timestamp - metrics.lastSeenAt > staleMetricsMs) {
        roomMetrics.delete(roomId);
      }
    }
    for (const [key, metrics] of awarenessMetrics.entries()) {
      if (timestamp - metrics.lastSeenAt > staleMetricsMs) {
        awarenessMetrics.delete(key);
      }
    }
    for (const [key, metrics] of syncMetrics.entries()) {
      if (timestamp - metrics.lastSeenAt > staleMetricsMs) {
        syncMetrics.delete(key);
      }
    }
  }

  function recordAwareness({ roomId, socketId, payloadBase64, payloadLen, connectedUsers }) {
    const timestamp = now();
    maybePrune(timestamp);
    const metrics = getRoomMetrics(roomId);
    metrics.lastSeenAt = timestamp;
    metrics.awarenessRecv += 1;
    metrics.bytesIn += payloadLen;
    metrics.connectedUsers = connectedUsers;
    maybeLogSummary(roomId, metrics, timestamp);

    const awarenessKey = `${roomId}::${socketId}`;
    const payloadHash = hashString(payloadBase64);
    const previous = awarenessMetrics.get(awarenessKey);
    if (
      !previous
      || previous.payloadHash !== payloadHash
      || timestamp - previous.windowStartedAt > awarenessRepeatWindowMs
    ) {
      awarenessMetrics.set(awarenessKey, {
        payloadHash,
        payloadLen,
        count: 1,
        windowStartedAt: timestamp,
        lastSeenAt: timestamp,
        lastWarnedAt: null,
      });
      return;
    }

    previous.count += 1;
    previous.lastSeenAt = timestamp;
    previous.payloadLen = payloadLen;
    if (
      previous.count >= awarenessRepeatThreshold
      && (previous.lastWarnedAt == null || timestamp - previous.lastWarnedAt >= awarenessRepeatWindowMs)
    ) {
      logger.warn(
        `[yjs-traffic:warn] room=${roomId} socket=${socketId} type=awareness-repeat ` +
        `payloadHash=${payloadHash} count=${previous.count} windowMs=${timestamp - previous.windowStartedAt} ` +
        `connectedUsers=${connectedUsers} payloadLen=${payloadLen}`
      );
      previous.lastWarnedAt = timestamp;
    }
  }

  function recordSync({ roomId, socketId, messageType, payloadLen, connectedUsers }) {
    const timestamp = now();
    maybePrune(timestamp);
    const metrics = getRoomMetrics(roomId);
    metrics.lastSeenAt = timestamp;
    metrics.syncRecv += 1;
    metrics.bytesIn += payloadLen;
    metrics.connectedUsers = connectedUsers;
    const syncTypeKey = String(messageType);
    metrics.syncMessageTypes.set(syncTypeKey, (metrics.syncMessageTypes.get(syncTypeKey) ?? 0) + 1);
    maybeLogSummary(roomId, metrics, timestamp);

    const syncKey = `${roomId}::${socketId}::${syncTypeKey}`;
    const previous = syncMetrics.get(syncKey);
    if (!previous || timestamp - previous.windowStartedAt > syncBurstWindowMs) {
      syncMetrics.set(syncKey, {
        count: 1,
        windowStartedAt: timestamp,
        lastSeenAt: timestamp,
        lastWarnedAt: null,
      });
      return;
    }

    previous.count += 1;
    previous.lastSeenAt = timestamp;
    if (
      previous.count >= syncBurstThreshold
      && (previous.lastWarnedAt == null || timestamp - previous.lastWarnedAt >= syncBurstWindowMs)
    ) {
      logger.warn(
        `[yjs-traffic:warn] room=${roomId} socket=${socketId} type=sync-burst ` +
        `messageType=${syncTypeKey} count=${previous.count} windowMs=${timestamp - previous.windowStartedAt} ` +
        `connectedUsers=${connectedUsers} payloadLen=${payloadLen}`
      );
      previous.lastWarnedAt = timestamp;
    }
  }

  return {
    recordAwareness,
    recordSync,
  };
}
