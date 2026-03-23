import test from "node:test";
import assert from "node:assert/strict";
import { createSocketLivenessMonitor } from "./socket-liveness.mjs";

function createSocket(overrides = {}) {
  const handlers = new Map();
  return {
    readyState: 1,
    pingCount: 0,
    terminateCount: 0,
    on(event, handler) {
      handlers.set(event, handler);
    },
    ping() {
      this.pingCount += 1;
    },
    terminate() {
      this.terminateCount += 1;
    },
    emit(event) {
      handlers.get(event)?.();
    },
    ...overrides,
  };
}

test("socket-liveness sends pings before terminating a stale socket", () => {
  const socket = createSocket();
  const warnings = [];
  const monitor = createSocketLivenessMonitor({
    wsServer: { clients: new Set([socket]) },
    WebSocket: { OPEN: 1 },
    getConnectionId: () => "socket-1",
    getConnectionState: () => ({ roomId: "room-1" }),
    logger: { warn: (message) => warnings.push(message) },
    startInterval: false,
    intervalMs: 1000,
  });

  monitor.trackSocket(socket);
  monitor.runHeartbeatCheck();
  monitor.runHeartbeatCheck();

  assert.equal(socket.pingCount, 1);
  assert.equal(socket.terminateCount, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /missed-pong/);
});

test("socket-liveness pong keeps a socket alive", () => {
  const socket = createSocket();
  const monitor = createSocketLivenessMonitor({
    wsServer: { clients: new Set([socket]) },
    WebSocket: { OPEN: 1 },
    getConnectionId: () => "socket-1",
    getConnectionState: () => ({ roomId: "room-1" }),
    logger: { warn: () => {} },
    startInterval: false,
    intervalMs: 1000,
  });

  monitor.trackSocket(socket);
  monitor.runHeartbeatCheck();
  socket.emit("pong");
  monitor.runHeartbeatCheck();

  assert.equal(socket.pingCount, 2);
  assert.equal(socket.terminateCount, 0);
});
