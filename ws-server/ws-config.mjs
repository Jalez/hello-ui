function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return fallback;
}

export function readWsConfig(env = process.env) {
  return {
    wsHeartbeatIntervalMs: parsePositiveInteger(env.WS_HEARTBEAT_INTERVAL_MS, 30_000),
    wsMaxBufferedAmountBytes: parsePositiveInteger(env.WS_MAX_BUFFERED_AMOUNT_BYTES, 2 * 1024 * 1024),
    wsMaxPayloadBytes: parsePositiveInteger(env.WS_MAX_PAYLOAD_BYTES, 4 * 1024 * 1024),
    wsUnknownMessageLogCooldownMs: parsePositiveInteger(env.WS_UNKNOWN_MESSAGE_LOG_COOLDOWN_MS, 60_000),
    wsPerMessageDeflate: parseBoolean(env.WS_PERMESSAGE_DEFLATE, true),
  };
}
