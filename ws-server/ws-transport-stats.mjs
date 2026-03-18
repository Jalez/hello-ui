function createCounterSnapshot(state) {
  return {
    slowConsumerDisconnects: state.slowConsumerDisconnects,
    slowConsumerBlockedSends: state.slowConsumerBlockedSends,
    sendErrors: state.sendErrors,
    sendThrows: state.sendThrows,
    unknownInboundMessages: state.unknownInboundMessages,
    invalidInboundMessages: state.invalidInboundMessages,
    peakBufferedAmountBytes: state.peakBufferedAmountBytes,
  };
}

export function createWsTransportStats(deps = {}) {
  const logger = deps.logger || console;
  const unknownMessageLogCooldownMs = Number.isFinite(deps.unknownMessageLogCooldownMs)
    ? deps.unknownMessageLogCooldownMs
    : 60_000;
  const now = deps.now || (() => Date.now());

  const state = {
    slowConsumerDisconnects: 0,
    slowConsumerBlockedSends: 0,
    sendErrors: 0,
    sendThrows: 0,
    unknownInboundMessages: 0,
    invalidInboundMessages: 0,
    peakBufferedAmountBytes: 0,
  };
  const unknownMessageLogByType = new Map();

  function recordPeakBufferedAmount(bufferedAmount) {
    if (Number.isFinite(bufferedAmount) && bufferedAmount > state.peakBufferedAmountBytes) {
      state.peakBufferedAmountBytes = bufferedAmount;
    }
  }

  function recordSlowConsumer({ socketId, roomId, bufferedAmount, limit }) {
    state.slowConsumerBlockedSends += 1;
    state.slowConsumerDisconnects += 1;
    recordPeakBufferedAmount(bufferedAmount);
    logger.warn(
      `[slow-consumer] socket=${socketId} room=${roomId || "none"} bufferedAmount=${bufferedAmount} limit=${limit}`
    );
  }

  function recordSendError({ socketId, roomId, error }) {
    state.sendErrors += 1;
    logger.warn(
      `[socket:send-error] socket=${socketId} room=${roomId || "none"} message=${error?.message || String(error)}`
    );
  }

  function recordSendThrow({ socketId, roomId, error }) {
    state.sendThrows += 1;
    logger.warn(
      `[socket:send-throw] socket=${socketId} room=${roomId || "none"} message=${error?.message || String(error)}`
    );
  }

  function recordInvalidInboundMessage() {
    state.invalidInboundMessages += 1;
  }

  function recordUnknownInboundMessage({ socketId, roomId, type }) {
    state.unknownInboundMessages += 1;
    const messageType = typeof type === "string" && type.length > 0 ? type : "unknown";
    const timestamp = now();
    const lastWarnAt = unknownMessageLogByType.get(messageType);
    if (
      Number.isFinite(lastWarnAt)
      && unknownMessageLogCooldownMs > 0
      && timestamp - lastWarnAt < unknownMessageLogCooldownMs
    ) {
      return;
    }
    unknownMessageLogByType.set(messageType, timestamp);
    logger.warn(
      `[ws-unknown-message] socket=${socketId} room=${roomId || "none"} type=${messageType}`
    );
  }

  return {
    recordPeakBufferedAmount,
    recordSlowConsumer,
    recordSendError,
    recordSendThrow,
    recordInvalidInboundMessage,
    recordUnknownInboundMessage,
    getSnapshot() {
      return createCounterSnapshot(state);
    },
  };
}
