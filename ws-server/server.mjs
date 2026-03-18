import { createServer } from "http";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import dotenv from "dotenv";
import { createWsApiClient } from "./api-client.mjs";
import { logCollaborationStep } from "./log-collaboration-step.mjs";
import {
  createLevelState,
  createRoomState,
  createStarterLevel,
  ensureLevelState,
  mergeTemplateAndProgressLevels,
  serializeLevelState,
  serializeProgressData,
} from "./level-state.mjs";
import {
  extractGameIdFromRoomId,
  extractGroupIdFromRoomId,
  isLobbyRoom,
  parseRoomContext,
} from "./room-context.mjs";
import { parseEnvelope, readJsonBody } from "./ws-envelope.mjs";
import { createHttpRequestHandler } from "./http-routes.mjs";
import { createSocketMessageRouter } from "./socket-router.mjs";
import { createRoomMembership } from "./room-membership.mjs";
import { createRoomStateService } from "./room-state-service.mjs";
import { removeSocketSession } from "./socket-handlers/session.mjs";
import { createWsRuntimeContext } from "./ws-runtime-context.mjs";
import {
  applyStartedGateToLevels as applyStartedGateToLevelsForState,
  ensureGroupStartGate as ensureGroupStartGateForState,
  isGroupInstanceContext,
  serializeCodeLevels as serializeCodeLevelsForRoom,
  serializeGroupStartSync as serializeGroupStartSyncForRoom,
  serializeRoomStateSync as serializeRoomStateSyncForRoom,
} from "./group-state.mjs";
import { createDuplicateIdentityService } from "./duplicate-identity.mjs";
import { createYjsRoomStateService } from "./yjs-room-state.mjs";
import { createCollabHealthService } from "./collab-health.mjs";
import { createSocketLivenessMonitor } from "./socket-liveness.mjs";
import { verifyWsAuthToken } from "./ws-auth-token.mjs";
import { readWsConfig } from "./ws-config.mjs";
import { createWsTransportStats } from "./ws-transport-stats.mjs";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "..");
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const PORT = parseInt(process.env.PORT || "3100", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const WS_SERVICE_TOKEN = process.env.WS_SERVICE_TOKEN || (process.env.NODE_ENV !== "production" ? "ws-service-secret" : "");
const WRITE_BUFFER_FLUSH_MS = 5000;
const WRITE_BUFFER_QUIET_MS = WRITE_BUFFER_FLUSH_MS;
const WRITE_DIRTY_WARN_THRESHOLD = 25;
const EDITOR_TYPES = ["html", "css", "js"];
const GROUP_START_MIN_READY_COUNT = 2;
const WS_ARTIFICIAL_DELAY_MS = parseInt(process.env.WS_ARTIFICIAL_DELAY_MS || "0", 10);
const WS_ARTIFICIAL_JITTER_MS = parseInt(process.env.WS_ARTIFICIAL_JITTER_MS || "0", 10);
const CLIENT_HASH_TTL_MS = 15000;
const DIVERGENCE_PERSIST_MS = 8000;
const DIVERGENCE_REPEAT_THRESHOLD = 5;
const DIVERGENCE_RESYNC_COOLDOWN_MS = 30000;
const DIVERGENCE_SOFT_RESYNC_ESCALATION = 3;
const {
  wsHeartbeatIntervalMs: WS_HEARTBEAT_INTERVAL_MS,
  wsMaxBufferedAmountBytes: WS_MAX_BUFFERED_AMOUNT_BYTES,
  wsMaxPayloadBytes: WS_MAX_PAYLOAD_BYTES,
  wsUnknownMessageLogCooldownMs: WS_UNKNOWN_MESSAGE_LOG_COOLDOWN_MS,
  wsPerMessageDeflate: WS_PERMESSAGE_DEFLATE,
} = readWsConfig(process.env);
const {
  fetchInstanceSnapshotFromDB,
  fetchCreatorLevels,
  fetchLevelsForMapName,
  saveProgressToDB,
} = createWsApiClient({
  apiBaseUrl: API_BASE_URL,
  wsServiceToken: WS_SERVICE_TOKEN,
});

// roomId -> Map<WebSocket, userData>
const rooms = new Map();
const connectionState = new WeakMap();

// roomId -> { ctx, progressData, levels, templateLevels, mapName }
const roomEditorState = new Map();
const roomLobbyState = new Map();
const roomYDocs = new Map();
const roomYDocGenerations = new Map();
const roomAwarenessStates = new Map();
const roomAwarenessConnections = new Map();

// roomId -> { ctx, timer }
const roomWriteBuffer = new Map();
const roomClientStateHashes = new Map();
const roomDivergenceState = new Map();
const wsTransportStats = createWsTransportStats({
  logger: console,
  unknownMessageLogCooldownMs: WS_UNKNOWN_MESSAGE_LOG_COOLDOWN_MS,
});

let roomStateService = null;
const ensureRoomState = (...args) => roomStateService.ensureRoomState(...args);
const flushWriteBuffer = (...args) => roomStateService.flushWriteBuffer(...args);
const markRoomDirty = (...args) => roomStateService.markRoomDirty(...args);

const {
  getRoomUsers,
  clearRoomMemory,
  addUserToRoom,
  removeUserFromRoom,
  ensureLobbyState,
  setConnectionState,
  getConnectionState,
  getConnectionId,
  summarizeRoomMembers,
  logRoomSnapshot,
  sendMessage,
  broadcastToRoom,
} = createRoomMembership({
  rooms,
  connectionState,
  roomLobbyState,
  roomEditorState,
  roomYDocs,
  roomYDocGenerations,
  roomAwarenessStates,
  roomAwarenessConnections,
  roomClientStateHashes,
  roomDivergenceState,
  roomWriteBuffer,
  flushWriteBuffer,
  parseRoomContext,
  randomUUID,
  WebSocket,
  artificialDelayMs: WS_ARTIFICIAL_DELAY_MS,
  artificialJitterMs: WS_ARTIFICIAL_JITTER_MS,
  maxBufferedAmountBytes: WS_MAX_BUFFERED_AMOUNT_BYTES,
  transportStats: wsTransportStats,
});

const {
  resolveDuplicateIdentity,
} = createDuplicateIdentityService({
  getRoomUsers,
});

const {
  isYjsEnabled,
  decodeBase64Update,
  getRoomYDocGeneration,
  advanceRoomYDocGeneration,
  sendYjsProtocol,
  broadcastYjsProtocol,
  createRoomYDoc,
  getOrCreateYDoc,
  applyYjsAwarenessUpdate,
  cleanupSocketAwareness,
  destroyRoomYResources,
  syncStateFromYDoc,
  sendFullAwarenessState,
} = createYjsRoomStateService({
  editorTypes: EDITOR_TYPES,
  roomYDocs,
  roomYDocGenerations,
  roomAwarenessStates,
  roomAwarenessConnections,
  roomEditorState,
  sendMessage,
  broadcastToRoom,
  extractGroupIdFromRoomId,
  markRoomDirty,
  awarenessProtocol,
  encoding,
  syncProtocol,
  Y,
  WebSocket,
});

const ensureGroupStartGate = (state) => ensureGroupStartGateForState(state, GROUP_START_MIN_READY_COUNT);
const applyStartedGateToLevels = (state) => applyStartedGateToLevelsForState(
  state,
  GROUP_START_MIN_READY_COUNT,
  ensureLevelState,
);
const serializeGroupStartSync = (roomId, state) => serializeGroupStartSyncForRoom(
  roomId,
  state,
  GROUP_START_MIN_READY_COUNT,
);
const serializeRoomStateSync = (roomId, state) => serializeRoomStateSyncForRoom(
  roomId,
  state,
  {
    isYjsEnabled,
    syncStateFromYDoc,
    serializeLevelState,
    getRoomYDocGeneration,
    minReadyCount: GROUP_START_MIN_READY_COUNT,
  },
);
const serializeCodeLevels = (roomId, state) => serializeCodeLevelsForRoom(
  roomId,
  state,
  {
    syncStateFromYDoc,
    serializeLevelState,
    minReadyCount: GROUP_START_MIN_READY_COUNT,
  },
);

roomStateService = createRoomStateService({
  roomEditorState,
  roomWriteBuffer,
  roomDivergenceState,
  rooms,
  editorTypes: EDITOR_TYPES,
  writeBufferQuietMs: WRITE_BUFFER_QUIET_MS,
  writeDirtyWarnThreshold: WRITE_DIRTY_WARN_THRESHOLD,
  fetchCreatorLevels,
  fetchInstanceSnapshotFromDB,
  fetchLevelsForMapName,
  saveProgressToDB,
  createRoomState,
  createStarterLevel,
  mergeTemplateAndProgressLevels,
  ensureGroupStartGate,
  applyStartedGateToLevels,
  getOrCreateYDoc,
  destroyRoomYResources,
  serializeCodeLevels,
});

/**
 * COLLABORATION STEP 7.1:
 * Small delay helper used only when intentionally simulating lag during debugging.
 */
function sleep(ms) {
  logCollaborationStep("7.1", "sleep", { ms });
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * COLLABORATION STEP 7.2:
 * Optionally slow down message handling to reproduce race conditions and desyncs
 * under controlled artificial latency.
 */
async function maybeDelaySocketHandling() {
  logCollaborationStep("7.2", "maybeDelaySocketHandling", {
    artificialDelayMs: WS_ARTIFICIAL_DELAY_MS,
    artificialJitterMs: WS_ARTIFICIAL_JITTER_MS,
  });
  if (WS_ARTIFICIAL_DELAY_MS <= 0 && WS_ARTIFICIAL_JITTER_MS <= 0) {
    return;
  }
  const jitter = WS_ARTIFICIAL_JITTER_MS > 0 ? Math.floor(Math.random() * WS_ARTIFICIAL_JITTER_MS) : 0;
  await sleep(WS_ARTIFICIAL_DELAY_MS + jitter);
}

const {
  getRoomClientHashes,
  removeClientStateHash,
  evaluateClientStateHashes,
} = createCollabHealthService({
  roomClientStateHashes,
  roomDivergenceState,
  extractGroupIdFromRoomId,
  clientHashTtlMs: CLIENT_HASH_TTL_MS,
  divergencePersistMs: DIVERGENCE_PERSIST_MS,
  divergenceRepeatThreshold: DIVERGENCE_REPEAT_THRESHOLD,
  divergenceResyncCooldownMs: DIVERGENCE_RESYNC_COOLDOWN_MS,
  softResyncEscalation: DIVERGENCE_SOFT_RESYNC_ESCALATION,
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
});

function invalidateGameInstanceRooms(gameId, payload = {}) {
  const matchingRooms = Array.from(rooms.entries())
    .map(([roomId, room]) => ({ roomId, room, ctx: parseRoomContext(roomId) }))
    .filter(({ ctx }) => ctx?.kind === "instance" && ctx.gameId === gameId);

  const roomIds = matchingRooms.map(({ roomId }) => roomId);
  const socketsToClose = [];

  for (const { roomId, room } of matchingRooms) {
    const message = {
      gameId,
      roomIds,
      ...payload,
      ts: Date.now(),
    };
    logRoomSnapshot("instances-reset", roomId, {
      deletedCount: payload.deletedCount ?? null,
      actorUserId: payload.actorUserId || null,
    });
    for (const roomSocket of room.keys()) {
      sendMessage(roomSocket, "game-instances-reset", message);
      socketsToClose.push(roomSocket);
    }
    rooms.delete(roomId);
    clearRoomMemory(roomId);
  }

  setTimeout(() => {
    for (const roomSocket of socketsToClose) {
      try {
        if (roomSocket.readyState === WebSocket.OPEN || roomSocket.readyState === WebSocket.CONNECTING) {
          roomSocket.close(4000, "game instances reset");
        }
      } catch {
        // Ignore close errors from already-closed sockets.
      }
    }
  }, 50);

  return { roomIds, invalidatedRoomCount: matchingRooms.length, disconnectedSocketCount: socketsToClose.length };
}

const httpServer = createServer(createHttpRequestHandler({
  port: PORT,
  wsServiceToken: WS_SERVICE_TOKEN,
  rooms,
  readJsonBody,
  summarizeRoomMembers,
  invalidateGameInstanceRooms,
  getWsStats: () => ({
    rooms: rooms.size,
    sockets: Array.from(rooms.values()).reduce((total, room) => total + room.size, 0),
    transport: wsTransportStats.getSnapshot(),
    config: {
      perMessageDeflate: WS_PERMESSAGE_DEFLATE,
      maxBufferedAmountBytes: WS_MAX_BUFFERED_AMOUNT_BYTES,
      maxPayloadBytes: WS_MAX_PAYLOAD_BYTES,
      unknownMessageLogCooldownMs: WS_UNKNOWN_MESSAGE_LOG_COOLDOWN_MS,
    },
  }),
}));

const wsServer = new WebSocketServer({
  server: httpServer,
  perMessageDeflate: WS_PERMESSAGE_DEFLATE,
  maxPayload: WS_MAX_PAYLOAD_BYTES,
});

const socketLivenessMonitor = createSocketLivenessMonitor({
  wsServer,
  WebSocket,
  getConnectionId,
  getConnectionState,
  intervalMs: WS_HEARTBEAT_INTERVAL_MS,
});

wsServer.on("error", (error) => {
  console.error("[ws-server:error]", error);
});

const wsRuntimeContext = createWsRuntimeContext({
  maybeDelaySocketHandling,
  parseEnvelope,
  sendMessage,
  getConnectionState,
  getConnectionId,
  setConnectionState,
  parseRoomContext,
  extractGameIdFromRoomId,
  extractGroupIdFromRoomId,
  isLobbyRoom,
  isYjsEnabled,
  getRoomUsers,
  addUserToRoom,
  removeUserFromRoom,
  ensureLobbyState,
  ensureRoomState,
  serializeRoomStateSync,
  serializeGroupStartSync,
  resolveDuplicateIdentity,
  broadcastToRoom,
  logRoomSnapshot,
  getOrCreateYDoc,
  decodeBase64Update,
  sendYjsProtocol,
  applyYjsAwarenessUpdate,
  cleanupSocketAwareness,
  sendFullAwarenessState,
  editorTypes: EDITOR_TYPES,
  getRoomClientHashes,
  removeClientStateHash,
  evaluateClientStateHashes,
  rooms,
  markRoomDirty,
  isGroupInstanceContext,
  applyStartedGateToLevels,
  ensureGroupStartGate,
  fetchLevelsForMapName,
  createRoomState,
  serializeProgressData,
  createLevelState,
  roomEditorState,
  createRoomYDoc,
  getRoomYDocGeneration,
  advanceRoomYDocGeneration,
  roomWriteBuffer,
  saveProgressToDB,
  serializeCodeLevels,
  verifyWsAuthToken,
  transportStats: wsTransportStats,
});

const handleSocketMessage = createSocketMessageRouter(wsRuntimeContext);

wsServer.on("connection", (socket, request) => {
  setConnectionState(socket, { id: randomUUID(), roomId: null });
  socketLivenessMonitor.trackSocket(socket);
  const remoteAddress = request?.socket?.remoteAddress || "unknown";
  const userAgent = request?.headers?.["user-agent"] || "unknown";
  console.log(`[connect] socket=${getConnectionId(socket)} remote=${remoteAddress} ua=${JSON.stringify(userAgent)}`);

  socket.on("error", (error) => {
    const socketId = getConnectionId(socket);
    const roomId = getConnectionState(socket)?.roomId || "none";
    console.error(
      `[socket:error] socket=${socketId} room=${roomId} remote=${remoteAddress} ua=${JSON.stringify(userAgent)} code=${error?.code || "unknown"} message=${error?.message || String(error)}`
    );

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      try {
        socket.close(1002, "Protocol error");
      } catch {
        // Ignore close races if the socket is already gone.
      }
    }
  });

  socket.on("message", async (rawMessage) => {
    await handleSocketMessage(socket, rawMessage);
  });

  socket.on("close", (code, reasonBuffer) => {
    const socketId = getConnectionId(socket);
    const reason = reasonBuffer?.toString?.() || String(code);
    console.log(`[disconnect] socket=${socketId} reason=${reason}`);

    const roomId = getConnectionState(socket)?.roomId || null;
    if (roomId) {
      removeSocketSession({
        socket,
        roomId,
        socketId,
        ctx: wsRuntimeContext,
        snapshotReason: "disconnect",
        snapshotExtra: { reason },
      });
      return;
    }

    setConnectionState(socket, { roomId: null });
  });
});

/**
 * COLLABORATION STEP 19.11:
 * Force-save every dirty collaboration room during shutdown so recent edits are
 * not lost when the websocket server exits.
 */
process.on("SIGTERM", async () => {
  console.log("[shutdown] SIGTERM received, flushing buffers...");
  socketLivenessMonitor.stop();
  await roomStateService.flushAllBuffers();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[shutdown] SIGINT received, flushing buffers...");
  socketLivenessMonitor.stop();
  await roomStateService.flushAllBuffers();
  process.exit(0);
});

httpServer.listen(PORT, () => {
  console.log(`WS server listening on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
  console.log(`API base URL: ${API_BASE_URL}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
