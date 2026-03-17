import test from "node:test";
import assert from "node:assert/strict";
import { sessionHandlers } from "./session.mjs";

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
