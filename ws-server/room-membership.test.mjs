import test from "node:test";
import assert from "node:assert/strict";
import { createRoomMembership } from "./room-membership.mjs";
import { createWsTransportStats } from "./ws-transport-stats.mjs";

function createMembership(overrides = {}) {
  return createRoomMembership({
    rooms: new Map(),
    connectionState: new WeakMap(),
    roomLobbyState: new Map(),
    roomEditorState: new Map(),
    roomYDocs: new Map(),
    roomYDocGenerations: new Map(),
    roomAwarenessStates: new Map(),
    roomAwarenessConnections: new Map(),
    roomClientStateHashes: new Map(),
    roomDivergenceState: new Map(),
    roomWriteBuffer: new Map(),
    flushWriteBuffer: async () => {},
    parseRoomContext: () => null,
    randomUUID: () => "socket-1",
    WebSocket: { OPEN: 1, CONNECTING: 0 },
    artificialDelayMs: 0,
    artificialJitterMs: 0,
    maxBufferedAmountBytes: 1024,
    logger: { warn: () => {} },
    ...overrides,
  });
}

test("room-membership sendMessage closes a slow consumer before sending", () => {
  const warnings = [];
  const transportStats = createWsTransportStats({
    logger: { warn: (message) => warnings.push(message) },
  });
  const socket = {
    readyState: 1,
    bufferedAmount: 2048,
    sendCount: 0,
    closeArgs: null,
    send() {
      this.sendCount += 1;
    },
    close(...args) {
      this.closeArgs = args;
    },
  };
  const membership = createMembership({
    transportStats,
  });
  membership.setConnectionState(socket, { roomId: "room-1" });

  membership.sendMessage(socket, "event", { ok: true });

  assert.equal(socket.sendCount, 0);
  assert.deepEqual(socket.closeArgs, [1013, "Slow consumer"]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /slow-consumer/);
  assert.deepEqual(transportStats.getSnapshot(), {
    slowConsumerDisconnects: 1,
    slowConsumerBlockedSends: 1,
    sendErrors: 0,
    sendThrows: 0,
    unknownInboundMessages: 0,
    invalidInboundMessages: 0,
    peakBufferedAmountBytes: 2048,
  });
});

test("room-membership sendMessage sends when buffered amount is within limits", () => {
  const sent = [];
  const socket = {
    readyState: 1,
    bufferedAmount: 128,
    send(data, callback) {
      sent.push(JSON.parse(data));
      callback?.();
    },
  };
  const membership = createMembership();

  membership.sendMessage(socket, "event", { ok: true });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "event");
  assert.deepEqual(sent[0].payload, { ok: true });
});

test("room-membership sendMessage records callback send errors", () => {
  const transportStats = createWsTransportStats({
    logger: { warn: () => {} },
  });
  const socket = {
    readyState: 1,
    bufferedAmount: 64,
    closeArgs: null,
    send(_data, callback) {
      callback?.(new Error("write failed"));
    },
    close(...args) {
      this.closeArgs = args;
    },
  };
  const membership = createMembership({
    transportStats,
  });
  membership.setConnectionState(socket, { roomId: "room-1" });

  membership.sendMessage(socket, "event", { ok: true });

  assert.deepEqual(socket.closeArgs, [1011, "Send error"]);
  assert.equal(transportStats.getSnapshot().sendErrors, 1);
});

test("room-membership sendMessage records thrown send failures", () => {
  const transportStats = createWsTransportStats({
    logger: { warn: () => {} },
  });
  const socket = {
    readyState: 1,
    bufferedAmount: 64,
    closeArgs: null,
    send() {
      throw new Error("boom");
    },
    close(...args) {
      this.closeArgs = args;
    },
  };
  const membership = createMembership({
    transportStats,
  });
  membership.setConnectionState(socket, { roomId: "room-1" });

  membership.sendMessage(socket, "event", { ok: true });

  assert.deepEqual(socket.closeArgs, [1011, "Send error"]);
  assert.equal(transportStats.getSnapshot().sendThrows, 1);
});
