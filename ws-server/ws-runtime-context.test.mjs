import test from "node:test";
import assert from "node:assert/strict";
import { createWsRuntimeContext } from "./ws-runtime-context.mjs";

test("createWsRuntimeContext preserves the handler-facing surface", () => {
  const deps = {
    maybeDelaySocketHandling: () => {},
    parseEnvelope: () => null,
    sendMessage: () => {},
    getConnectionState: () => null,
    getConnectionId: () => "socket-1",
    setConnectionState: () => {},
    parseRoomContext: () => null,
    extractGameIdFromRoomId: () => "game-1",
    extractGroupIdFromRoomId: () => "group-1",
    isLobbyRoom: () => false,
    isYjsEnabled: () => true,
    getRoomUsers: () => new Map(),
    addUserToRoom: () => {},
    removeUserFromRoom: () => null,
    ensureLobbyState: () => ({ messages: [] }),
    ensureRoomState: async () => ({}),
    serializeRoomStateSync: () => ({}),
    serializeGroupStartSync: () => null,
    resolveDuplicateIdentity: () => ({ effectiveUserId: "user-1", duplicateIndex: 0 }),
    broadcastToRoom: () => {},
    logRoomSnapshot: () => {},
    getOrCreateYDoc: () => ({}),
    decodeBase64Update: () => new Uint8Array(),
    sendYjsProtocol: () => {},
    applyYjsAwarenessUpdate: () => {},
    cleanupSocketAwareness: () => {},
    sendFullAwarenessState: () => {},
    editorTypes: ["html", "css", "js"],
    getRoomClientHashes: () => new Map(),
    removeClientStateHash: () => {},
    evaluateClientStateHashes: async () => {},
    rooms: new Map(),
    markRoomDirty: () => {},
    isGroupInstanceContext: () => false,
    applyStartedGateToLevels: () => {},
    ensureGroupStartGate: () => null,
    fetchLevelsForMapName: async () => [],
    createRoomState: () => ({}),
    serializeProgressData: () => ({}),
    createLevelState: () => ({}),
    roomEditorState: new Map(),
    createRoomYDoc: () => ({}),
    getRoomYDocGeneration: () => 0,
    advanceRoomYDocGeneration: () => 1,
    roomWriteBuffer: new Map(),
    saveProgressToDB: async () => ({ ok: true }),
    serializeCodeLevels: () => ({ levels: [] }),
    verifyWsAuthToken: () => null,
    transportStats: null,
    setHandshakeGrace: () => {},
    clearHandshakeGrace: () => {},
  };

  const ctx = createWsRuntimeContext(deps);

  assert.deepEqual(Object.keys(ctx).sort(), Object.keys(deps).sort());
  assert.equal(ctx.sendMessage, deps.sendMessage);
  assert.equal(ctx.ensureRoomState, deps.ensureRoomState);
  assert.equal(ctx.editorTypes, deps.editorTypes);
  assert.equal(ctx.rooms, deps.rooms);
});
