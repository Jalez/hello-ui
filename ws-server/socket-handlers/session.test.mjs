import test from "node:test";
import assert from "node:assert/strict";
import { removeSocketSession, sessionHandlers } from "./session.mjs";

test("removeSocketSession clears connection state even when socket is already missing", () => {
  const socket = {};
  const calls = {
    setConnectionState: [],
    cleanupSocketAwareness: [],
    removeClientStateHash: [],
    broadcastToRoom: [],
    logRoomSnapshot: [],
  };

  const result = removeSocketSession({
    socket,
    roomId: "room-1",
    socketId: "socket-1",
    ctx: {
      removeUserFromRoom: () => null,
      setConnectionState: (...args) => calls.setConnectionState.push(args),
      cleanupSocketAwareness: (...args) => calls.cleanupSocketAwareness.push(args),
      removeClientStateHash: (...args) => calls.removeClientStateHash.push(args),
      broadcastToRoom: (...args) => calls.broadcastToRoom.push(args),
      logRoomSnapshot: (...args) => calls.logRoomSnapshot.push(args),
    },
    snapshotReason: "disconnect",
    snapshotExtra: { reason: "1001" },
  });

  assert.equal(result, null);
  assert.deepEqual(calls.setConnectionState, [[socket, { roomId: null }]]);
  assert.deepEqual(calls.cleanupSocketAwareness, []);
  assert.deepEqual(calls.removeClientStateHash, []);
  assert.deepEqual(calls.broadcastToRoom, []);
  assert.deepEqual(calls.logRoomSnapshot, []);
});

test("leave-game cleans awareness and broadcasts exact client session", async () => {
  const socket = {};
  const calls = {
    cleanupSocketAwareness: [],
    removeClientStateHash: [],
    broadcastToRoom: [],
    setConnectionState: [],
  };

  const userData = {
    clientId: "client-123",
    userId: "user-123",
    userEmail: "user@example.com",
    userName: "Example User",
  };

  await sessionHandlers["leave-game"]({
    socket,
    data: { roomId: "room-1" },
    socketId: "socket-1",
    resolveRoomId: () => "room-1",
    ctx: {
      removeUserFromRoom: () => userData,
      setConnectionState: (...args) => calls.setConnectionState.push(args),
      cleanupSocketAwareness: (...args) => calls.cleanupSocketAwareness.push(args),
      removeClientStateHash: (...args) => calls.removeClientStateHash.push(args),
      broadcastToRoom: (...args) => calls.broadcastToRoom.push(args),
      logRoomSnapshot: () => {},
    },
  });

  assert.deepEqual(calls.setConnectionState, [[socket, { roomId: null }]]);
  assert.deepEqual(calls.cleanupSocketAwareness, [["room-1", socket]]);
  assert.deepEqual(calls.removeClientStateHash, [["room-1", "client-123"]]);
  assert.deepEqual(calls.broadcastToRoom, [[
    "room-1",
    "user-left",
    {
      clientId: "client-123",
      userId: "user-123",
      userEmail: "user@example.com",
      userName: "Example User",
    },
    socket,
  ]]);
});

test("join-game rejects an invalid auth token", async () => {
  const socket = {
    closeArgs: null,
    close(...args) {
      this.closeArgs = args;
    },
  };
  const sent = [];

  await sessionHandlers["join-game"]({
    socket,
    data: { roomId: "group:group-1:game:game-1", clientId: "client-1", authToken: "bad-token" },
    socketId: "socket-1",
    resolveRoomId: () => "group:group-1:game:game-1",
    ctx: {
      verifyWsAuthToken: () => null,
      sendMessage: (...args) => sent.push(args),
    },
  });

  assert.deepEqual(sent, [[socket, "error", { error: "Authentication required", code: "auth_failed" }]]);
  assert.deepEqual(socket.closeArgs, [4401, "Authentication required"]);
});
