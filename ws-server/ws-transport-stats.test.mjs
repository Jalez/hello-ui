import test from "node:test";
import assert from "node:assert/strict";
import { createWsTransportStats } from "./ws-transport-stats.mjs";

test("ws-transport-stats tracks send and slow-consumer counters", () => {
  const warnings = [];
  const stats = createWsTransportStats({
    logger: { warn: (message) => warnings.push(message) },
  });

  stats.recordPeakBufferedAmount(128);
  stats.recordSlowConsumer({
    socketId: "socket-1",
    roomId: "room-1",
    bufferedAmount: 2048,
    limit: 1024,
  });
  stats.recordSendError({
    socketId: "socket-1",
    roomId: "room-1",
    error: new Error("callback failed"),
  });
  stats.recordSendThrow({
    socketId: "socket-1",
    roomId: "room-1",
    error: new Error("send exploded"),
  });
  stats.recordInvalidInboundMessage();

  assert.deepEqual(stats.getSnapshot(), {
    slowConsumerDisconnects: 1,
    slowConsumerBlockedSends: 1,
    sendErrors: 1,
    sendThrows: 1,
    unknownInboundMessages: 0,
    invalidInboundMessages: 1,
    peakBufferedAmountBytes: 2048,
  });
  assert.equal(warnings.length, 3);
});

test("ws-transport-stats rate limits unknown inbound message warnings by type", () => {
  const warnings = [];
  let timestamp = 1_000;
  const stats = createWsTransportStats({
    logger: { warn: (message) => warnings.push(message) },
    now: () => timestamp,
    unknownMessageLogCooldownMs: 60_000,
  });

  stats.recordUnknownInboundMessage({ socketId: "socket-1", roomId: "room-1", type: "future-event" });
  stats.recordUnknownInboundMessage({ socketId: "socket-2", roomId: "room-2", type: "future-event" });
  timestamp += 60_001;
  stats.recordUnknownInboundMessage({ socketId: "socket-3", roomId: "room-3", type: "future-event" });

  assert.equal(stats.getSnapshot().unknownInboundMessages, 3);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /type=future-event/);
  assert.match(warnings[1], /type=future-event/);
});
