import { createServer } from "http";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import pg from "pg";
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
const GAME_DUPLICATE_SETTINGS_TTL_MS = 10000;
const CLIENT_HASH_TTL_MS = 15000;
const DIVERGENCE_PERSIST_MS = 8000;
const DIVERGENCE_REPEAT_THRESHOLD = 5;
const DIVERGENCE_RESYNC_COOLDOWN_MS = 30000;
const DIVERGENCE_SOFT_RESYNC_ESCALATION = 3;
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const dbPool = DATABASE_URL ? new pg.Pool({ connectionString: DATABASE_URL }) : null;
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
const gameDuplicateSettingsCache = new Map();

// roomId -> { ctx, timer }
const roomWriteBuffer = new Map();
const roomClientStateHashes = new Map();
const roomDivergenceState = new Map();
const roomLastSavedSnapshots = new Map();
const roomStateLoadPromises = new Map();

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
});

const {
  isDuplicateUserAllowed,
  resolveDuplicateIdentity,
  findDuplicateUsersInGame,
} = createDuplicateIdentityService({
  dbPool,
  gameDuplicateSettingsCache,
  gameDuplicateSettingsTtlMs: GAME_DUPLICATE_SETTINGS_TTL_MS,
  isLobbyRoom,
  rooms,
  getRoomUsers,
  extractGameIdFromRoomId,
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

/**
 * COLLABORATION STEP 8.13:
 * Load or create the authoritative server-side room state for this collaboration
 * session. This is where persisted progress, template levels, and the room's Yjs
 * document are aligned before edits are processed.
 */
async function ensureRoomState(roomId, ctx) {
  logCollaborationStep("8.13", "ensureRoomState", {
    roomId,
    kind: ctx.kind,
  });
  const existing = roomEditorState.get(roomId);
  if (existing) {
    existing.ctx = ctx;
    return existing;
  }

  const pendingLoad = roomStateLoadPromises.get(roomId);
  if (pendingLoad) {
    return pendingLoad;
  }

  const loadPromise = (async () => {
    const latestExisting = roomEditorState.get(roomId);
    if (latestExisting) {
      latestExisting.ctx = ctx;
      return latestExisting;
    }

    if (ctx.kind === "creator") {
      const creatorLevels = await fetchCreatorLevels(ctx);
      const nextState = createRoomState(ctx, { levels: creatorLevels }, {
        templateLevels: creatorLevels,
        mapName: ctx.mapName,
        instanceId: null,
      });
      roomEditorState.set(roomId, nextState);
      getOrCreateYDoc(roomId, nextState);
      return nextState;
    }

    const instanceSnapshot = await fetchInstanceSnapshotFromDB(ctx);
    const progressData =
      instanceSnapshot?.progressData && typeof instanceSnapshot.progressData === "object" && !Array.isArray(instanceSnapshot.progressData)
        ? instanceSnapshot.progressData
        : {};
    const mapName = typeof instanceSnapshot?.mapName === "string" ? instanceSnapshot.mapName : "";
    const templateLevels = mapName ? await fetchLevelsForMapName(mapName) : [];
    const progressLevels = Array.isArray(progressData.levels) ? progressData.levels : [];

    const normalizedLevels =
      templateLevels.length > 0
        ? mergeTemplateAndProgressLevels(templateLevels, progressLevels)
        : progressLevels;

    const finalLevels =
      normalizedLevels.length > 0
        ? normalizedLevels
        : [createStarterLevel(mapName)];

    const nextState = createRoomState(
      ctx,
      {
        ...progressData,
        levels: finalLevels,
      },
      {
        templateLevels,
        mapName,
        instanceId: instanceSnapshot?.instanceId ?? null,
      }
    );
    ensureGroupStartGate(nextState);
    applyStartedGateToLevels(nextState);

    roomEditorState.set(roomId, nextState);
    getOrCreateYDoc(roomId, nextState);

    const shouldPersistNormalizedLevels =
      JSON.stringify(progressLevels) !== JSON.stringify(finalLevels);
    roomLastSavedSnapshots.set(roomId, cloneSerializedLevelsPayload(serializeCodeLevels(roomId, nextState)));
    if (shouldPersistNormalizedLevels && finalLevels.length > 0) {
      const result = await saveProgressToDB(ctx, serializeCodeLevels(roomId, nextState));
      if (!result.ok && !result.permanentFailure) {
        markRoomDirty(roomId, ctx);
      }
    }

    return nextState;
  })();

  roomStateLoadPromises.set(roomId, loadPromise);
  try {
    return await loadPromise;
  } finally {
    if (roomStateLoadPromises.get(roomId) === loadPromise) {
      roomStateLoadPromises.delete(roomId);
    }
  }
}

/**
 * COLLABORATION STEP 11.3:
 * Start or restart the delayed save timer so rapid bursts of edits collapse into
 * one quieter persistence write instead of hammering the database.
 */
function scheduleFlush(roomId) {
  logCollaborationStep("11.3", "scheduleFlush", { roomId });
  const buffer = roomWriteBuffer.get(roomId);
  if (!buffer) {
    return;
  }

  if (buffer.timer) {
    clearTimeout(buffer.timer);
    buffer.timer = null;
  }

  buffer.timer = setTimeout(() => {
    buffer.timer = null;
    flushWriteBuffer(roomId, { reason: "scheduled" });
  }, WRITE_BUFFER_QUIET_MS);
}

/**
 * COLLABORATION STEP 11.4:
 * Hash persisted code so save logs can describe large snapshots compactly.
 */
function hashContent(content) {
  logCollaborationStep("11.4", "hashContent", {
    contentLength: content.length,
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * COLLABORATION STEP 11.5:
 * Summarize each level's saved code shape for debugging persistence without
 * dumping the full code contents into logs.
 */
function summarizePersistedLevels(levels = []) {
  logCollaborationStep("11.5", "summarizePersistedLevels", {
    levelsCount: levels.length,
  });
  return levels.map((level, levelIndex) => {
    const html = typeof level?.code?.html === "string" ? level.code.html : "";
    const css = typeof level?.code?.css === "string" ? level.code.css : "";
    const js = typeof level?.code?.js === "string" ? level.code.js : "";
    return {
      levelIndex,
      name: typeof level?.name === "string" ? level.name : `level-${levelIndex}`,
      htmlLength: html.length,
      htmlHash: hashContent(html),
      cssLength: css.length,
      cssHash: hashContent(css),
      jsLength: js.length,
      jsHash: hashContent(js),
    };
  });
}

/**
 * COLLABORATION STEP 11.6:
 * Deep-clone a serialized save payload so guarded persistence can safely keep a
 * previous known-good snapshot around.
 */
function cloneSerializedLevelsPayload(payload) {
  logCollaborationStep("11.6", "cloneSerializedLevelsPayload", {
    levelsCount: Array.isArray(payload?.levels) ? payload.levels.length : null,
  });
  return JSON.parse(JSON.stringify(payload));
}

/**
 * COLLABORATION STEP 17.3:
 * Check whether the server currently believes any editor in this room is diverged.
 */
function hasRoomDivergence(roomId) {
  logCollaborationStep("17.3", "hasRoomDivergence", { roomId });
  for (const key of roomDivergenceState.keys()) {
    if (key.startsWith(`${roomId}:`)) {
      return true;
    }
  }
  return false;
}

/**
 * COLLABORATION STEP 11.7:
 * Detect suspicious save regressions, such as a large drop to empty code, so the
 * server can avoid persisting obviously bad collaborative snapshots.
 */
function hasSevereSnapshotRegression(previousPayload, nextPayload) {
  logCollaborationStep("11.7", "hasSevereSnapshotRegression", {
    previousLevels: Array.isArray(previousPayload?.levels) ? previousPayload.levels.length : null,
    nextLevels: Array.isArray(nextPayload?.levels) ? nextPayload.levels.length : null,
  });
  const previousLevels = Array.isArray(previousPayload?.levels) ? previousPayload.levels : [];
  const nextLevels = Array.isArray(nextPayload?.levels) ? nextPayload.levels : [];
  const levelCount = Math.max(previousLevels.length, nextLevels.length);

  let previousTotal = 0;
  let nextTotal = 0;
  let zeroedEditorCount = 0;

  for (let levelIndex = 0; levelIndex < levelCount; levelIndex += 1) {
    const previousCode = previousLevels[levelIndex]?.code || {};
    const nextCode = nextLevels[levelIndex]?.code || {};
    for (const editorType of EDITOR_TYPES) {
      const previousContent = typeof previousCode[editorType] === "string" ? previousCode[editorType] : "";
      const nextContent = typeof nextCode[editorType] === "string" ? nextCode[editorType] : "";
      previousTotal += previousContent.length;
      nextTotal += nextContent.length;
      if (previousContent.length > 0 && nextContent.length === 0) {
        zeroedEditorCount += 1;
      }
    }
  }

  if (previousTotal === 0) {
    return false;
  }

  const totalDropRatio = (previousTotal - nextTotal) / previousTotal;
  return zeroedEditorCount > 0 || totalDropRatio >= 0.5;
}

/**
 * COLLABORATION STEP 10.4:
 * Mark a room as changed after Yjs updates land. In plain terms, this tells the
 * persistence layer that the shared code moved and needs to be saved soon.
 */
function markRoomDirty(roomId, ctx) {
  logCollaborationStep("10.4", "markRoomDirty", {
    roomId,
    gameId: ctx.gameId,
  });
  if (!roomWriteBuffer.has(roomId)) {
    roomWriteBuffer.set(roomId, {
      ctx,
      timer: null,
      lastDirtyAt: 0,
      firstDirtyAt: 0,
      dirtyCount: 0,
      lastWarnedDirtyCount: 0,
    });
  }
  const buffer = roomWriteBuffer.get(roomId);
  const now = Date.now();
  buffer.ctx = ctx;
  buffer.lastDirtyAt = now;
  if (!Number.isFinite(buffer.firstDirtyAt) || buffer.firstDirtyAt === 0) {
    buffer.firstDirtyAt = now;
    buffer.dirtyCount = 0;
    buffer.lastWarnedDirtyCount = 0;
  }
  buffer.dirtyCount += 1;
  const state = roomEditorState.get(roomId);
  if (state && buffer.dirtyCount === 1) {
    const serialized = serializeCodeLevels(roomId, state);
    console.log(
      `[db-save:dirty-start] room=${roomId} gameId=${ctx.gameId} groupId=${ctx.groupId || "none"} ` +
      `instanceId=${state.instanceId || "none"} levels=${JSON.stringify(summarizePersistedLevels(serialized.levels))}`
    );
  } else if (!state && buffer.dirtyCount === 1) {
    console.log(`[db-save:dirty-start] room=${roomId} gameId=${ctx.gameId} groupId=${ctx.groupId || "none"} state=missing`);
  }
  if (buffer.dirtyCount >= WRITE_DIRTY_WARN_THRESHOLD && buffer.dirtyCount - buffer.lastWarnedDirtyCount >= WRITE_DIRTY_WARN_THRESHOLD) {
    buffer.lastWarnedDirtyCount = buffer.dirtyCount;
    console.warn(
      `[db-save:dirty-churn] room=${roomId} gameId=${ctx.gameId} groupId=${ctx.groupId || "none"} ` +
      `dirtyCount=${buffer.dirtyCount} windowMs=${now - buffer.firstDirtyAt}`
    );
  }
  scheduleFlush(roomId);
}

/**
 * COLLABORATION STEP 11.8:
 * Persist the room's latest collaborative code to storage once the debounce window
 * is quiet enough, with extra guards against saving obviously regressed snapshots.
 */
async function flushWriteBuffer(roomId, options = {}) {
  logCollaborationStep("11.8", "flushWriteBuffer", {
    roomId,
    reason: typeof options.reason === "string" ? options.reason : "unknown",
    force: options.force === true,
  });
  const buffer = roomWriteBuffer.get(roomId);
  const state = roomEditorState.get(roomId);
  const force = options.force === true;
  const reason = typeof options.reason === "string" ? options.reason : "unknown";

  if (!buffer || !state) {
    if (buffer?.timer) {
      clearTimeout(buffer.timer);
    }
    roomWriteBuffer.delete(roomId);
    return;
  }

  if (!force && Number.isFinite(buffer.lastDirtyAt)) {
    const elapsedSinceDirty = Date.now() - buffer.lastDirtyAt;
    if (elapsedSinceDirty < WRITE_BUFFER_QUIET_MS) {
      const delayMs = WRITE_BUFFER_QUIET_MS - elapsedSinceDirty;
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }
      buffer.timer = setTimeout(() => {
        buffer.timer = null;
        flushWriteBuffer(roomId, { reason: "quiet-window" });
      }, delayMs);
      console.log(
        `[db-save:flush-delay] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
        `instanceId=${state.instanceId || "none"} reason=${reason} delayMs=${delayMs}`
      );
      return;
    }
  }

  if (buffer.timer) {
    clearTimeout(buffer.timer);
    buffer.timer = null;
  }

  const serialized = serializeCodeLevels(roomId, state);
  let payloadToSave = serialized;
  const previousSavedSnapshot = roomLastSavedSnapshots.get(roomId);
  if (
    previousSavedSnapshot
    && hasRoomDivergence(roomId)
    && hasSevereSnapshotRegression(previousSavedSnapshot, serialized)
  ) {
    payloadToSave = cloneSerializedLevelsPayload(previousSavedSnapshot);
    console.warn(
      `[db-save:guarded-prev] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
      `instanceId=${state.instanceId || "none"} connectedUsers=${rooms.get(roomId)?.size || 0} ` +
      `current=${JSON.stringify(summarizePersistedLevels(serialized.levels))} ` +
      `fallback=${JSON.stringify(summarizePersistedLevels(payloadToSave.levels))}`
    );
  }
  console.log(
    `[db-save:flush-start] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
    `instanceId=${state.instanceId || "none"} connectedUsers=${rooms.get(roomId)?.size || 0} reason=${reason} ` +
    `dirtyCount=${buffer.dirtyCount || 0} dirtyWindowMs=${buffer.firstDirtyAt ? Date.now() - buffer.firstDirtyAt : 0} ` +
    `levels=${JSON.stringify(summarizePersistedLevels(payloadToSave.levels))}`
  );
  const result = await saveProgressToDB(state.ctx, payloadToSave);

  if (result.ok) {
    roomWriteBuffer.delete(roomId);
    roomLastSavedSnapshots.set(roomId, cloneSerializedLevelsPayload(payloadToSave));
    console.log(
      `[db-save:flush-ok] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
      `instanceId=${state.instanceId || "none"} connectedUsers=${rooms.get(roomId)?.size || 0}`
    );
    if (!rooms.has(roomId)) {
      roomEditorState.delete(roomId);
      destroyRoomYResources(roomId);
    }
  } else if (result.permanentFailure) {
    roomWriteBuffer.delete(roomId);
    console.warn(
      `[db-save:flush-drop] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
      `instanceId=${state.instanceId || "none"} connectedUsers=${rooms.get(roomId)?.size || 0}`
    );
    if (!rooms.has(roomId)) {
      roomEditorState.delete(roomId);
      destroyRoomYResources(roomId);
    }
    console.warn(`[db-save:drop-room] room=${roomId} gameId=${state.ctx.gameId} reason=not-found`);
  } else {
    console.warn(
      `[db-save:flush-retry] room=${roomId} gameId=${state.ctx.gameId} groupId=${state.ctx.groupId || "none"} ` +
      `instanceId=${state.instanceId || "none"} connectedUsers=${rooms.get(roomId)?.size || 0}`
    );
    scheduleFlush(roomId);
  }
}

const httpServer = createServer(createHttpRequestHandler({
  port: PORT,
  wsServiceToken: WS_SERVICE_TOKEN,
  rooms,
  readJsonBody,
  summarizeRoomMembers,
  invalidateGameInstanceRooms,
}));

const wsServer = new WebSocketServer({
  server: httpServer,
  perMessageDeflate: true,
});

wsServer.on("error", (error) => {
  console.error("[ws-server:error]", error);
});

const wsRuntimeContext = {
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
  findDuplicateUsersInGame,
  isDuplicateUserAllowed,
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
};

const handleSocketMessage = createSocketMessageRouter(wsRuntimeContext);

wsServer.on("connection", (socket, request) => {
  setConnectionState(socket, { id: randomUUID(), roomId: null });
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

    for (const [roomId, userMap] of rooms.entries()) {
      if (userMap.has(socket)) {
        const userData = removeUserFromRoom(roomId, socket);
        if (userData) {
          cleanupSocketAwareness(roomId, socket);
          removeClientStateHash(roomId, userData.clientId);
          broadcastToRoom(roomId, "user-left", {
            clientId: userData.clientId,
            userId: userData.userId,
            userEmail: userData.userEmail,
            userName: userData.userName,
          });
          logRoomSnapshot("disconnect", roomId, { by: socketId, reason });
        }
      }
    }
    setConnectionState(socket, { roomId: null });
  });
});

/**
 * COLLABORATION STEP 19.11:
 * Force-save every dirty collaboration room during shutdown so recent edits are
 * not lost when the websocket server exits.
 */
async function flushAllBuffers() {
  logCollaborationStep("19.11", "flushAllBuffers", {
    bufferCount: roomWriteBuffer.size,
  });
  const promises = [];
  for (const roomId of roomWriteBuffer.keys()) {
    promises.push(flushWriteBuffer(roomId, { force: true, reason: "shutdown" }));
  }
  await Promise.allSettled(promises);
}

process.on("SIGTERM", async () => {
  console.log("[shutdown] SIGTERM received, flushing buffers...");
  await flushAllBuffers();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[shutdown] SIGINT received, flushing buffers...");
  await flushAllBuffers();
  process.exit(0);
});

httpServer.listen(PORT, () => {
  console.log(`WS server listening on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
  console.log(`API base URL: ${API_BASE_URL}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
