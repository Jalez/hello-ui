import { createServer } from "http";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { Text } from "@codemirror/state";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import pg from "pg";
import dotenv from "dotenv";
import { createWsApiClient } from "./api-client.mjs";
import {
  createLevelState,
  createRoomState,
  createStarterLevel,
  createVersionMap,
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

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "..");
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const PORT = parseInt(process.env.PORT || "3100", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const WS_SERVICE_TOKEN = process.env.WS_SERVICE_TOKEN || (process.env.NODE_ENV !== "production" ? "ws-service-secret" : "");
const COLLAB_ENGINE = process.env.COLLAB_ENGINE || process.env.NEXT_PUBLIC_COLLAB_ENGINE || "custom";
const WRITE_BUFFER_FLUSH_MS = 5000;
const EDITOR_TYPES = ["html", "css", "js"];
const GROUP_START_MIN_READY_COUNT = 2;
const WS_ARTIFICIAL_DELAY_MS = parseInt(process.env.WS_ARTIFICIAL_DELAY_MS || "0", 10);
const WS_ARTIFICIAL_JITTER_MS = parseInt(process.env.WS_ARTIFICIAL_JITTER_MS || "0", 10);
const GAME_DUPLICATE_SETTINGS_TTL_MS = 10000;
const CLIENT_HASH_TTL_MS = 10000;
const DIVERGENCE_PERSIST_MS = 1500;
const DIVERGENCE_REPEAT_THRESHOLD = 2;
const DIVERGENCE_RESYNC_COOLDOWN_MS = 5000;
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
const gameDuplicateSettingsCache = new Map();

// roomId -> { ctx, timer }
const roomWriteBuffer = new Map();
const roomClientStateHashes = new Map();
const roomDivergenceState = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function maybeDelaySocketHandling() {
  if (WS_ARTIFICIAL_DELAY_MS <= 0 && WS_ARTIFICIAL_JITTER_MS <= 0) {
    return;
  }
  const jitter = WS_ARTIFICIAL_JITTER_MS > 0 ? Math.floor(Math.random() * WS_ARTIFICIAL_JITTER_MS) : 0;
  await sleep(WS_ARTIFICIAL_DELAY_MS + jitter);
}

function getRoomUsers(roomId) {
  return rooms.get(roomId) || new Map();
}

function addUserToRoom(roomId, socket, userData) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  rooms.get(roomId).set(socket, userData);
}

function removeUserFromRoom(roomId, socket) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const userData = room.get(socket);
  room.delete(socket);

  if (room.size === 0) {
    rooms.delete(roomId);
    flushWriteBuffer(roomId).finally(() => {
      if (!rooms.has(roomId) && !roomWriteBuffer.has(roomId)) {
        roomEditorState.delete(roomId);
        roomLobbyState.delete(roomId);
        roomYDocs.get(roomId)?.destroy();
        roomYDocs.delete(roomId);
        roomYDocGenerations.delete(roomId);
        roomClientStateHashes.delete(roomId);
      }
    });
  }

  return userData;
}

function ensureLobbyState(roomId) {
  if (!roomLobbyState.has(roomId)) {
    roomLobbyState.set(roomId, { messages: [] });
  }
  return roomLobbyState.get(roomId);
}

function setConnectionState(socket, nextState) {
  const current = connectionState.get(socket) || { id: randomUUID(), roomId: null };
  connectionState.set(socket, { ...current, ...nextState });
}

function getConnectionState(socket) {
  return connectionState.get(socket) || null;
}

function getConnectionId(socket) {
  return getConnectionState(socket)?.id || "unknown";
}

function summarizeRoomMembers(roomId) {
  return Array.from(getRoomUsers(roomId).values()).map((user) => ({
    userId: user.userId || "",
    accountUserId: user.accountUserId || "",
    accountUserEmail: user.accountUserEmail || "",
    userEmail: user.userEmail || "",
    userName: user.userName || "",
    userImage: user.userImage || "",
    clientId: user.clientId || "",
  }));
}

function normalizeDuplicateBaseName(name, email, userId) {
  return name || email || userId || "Anonymous";
}

async function isDuplicateGroupUserAllowed(gameId) {
  if (!gameId) {
    return false;
  }

  const now = Date.now();
  const cached = gameDuplicateSettingsCache.get(gameId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (!dbPool) {
    return false;
  }

  try {
    const result = await dbPool.query(
      "SELECT allow_duplicate_group_users FROM projects WHERE id = $1 LIMIT 1",
      [gameId],
    );
    const value = result.rows[0]?.allow_duplicate_group_users === true;
    gameDuplicateSettingsCache.set(gameId, {
      value,
      expiresAt: now + GAME_DUPLICATE_SETTINGS_TTL_MS,
    });
    return value;
  } catch (error) {
    console.error("[duplicate-group-users:lookup-error]", error);
    return false;
  }
}

function parseDuplicateSessionIndex(userId, baseUserId) {
  if (!userId || !baseUserId) {
    return null;
  }
  if (userId === baseUserId) {
    return 1;
  }
  const prefix = `${baseUserId}::session-`;
  if (!userId.startsWith(prefix)) {
    return null;
  }
  const suffix = Number.parseInt(userId.slice(prefix.length), 10);
  return Number.isInteger(suffix) && suffix >= 2 ? suffix : null;
}

function resolveDuplicateIdentity(roomId, userData) {
  const roomUsers = Array.from(getRoomUsers(roomId).values());
  const duplicates = roomUsers.filter((entry) => {
    if (userData.userId && entry.accountUserId) {
      return entry.accountUserId === userData.userId;
    }
    if (userData.userEmail && entry.accountUserEmail) {
      return entry.accountUserEmail === userData.userEmail;
    }
    return false;
  });

  if (duplicates.length === 0) {
    return {
      effectiveUserId: userData.userId || userData.clientId,
      effectiveUserName: userData.userName,
      duplicateIndex: 0,
    };
  }

  const baseUserId = userData.userId || userData.clientId;
  const baseName = normalizeDuplicateBaseName(userData.userName, userData.userEmail, baseUserId);
  const usedIndexes = new Set(
    duplicates
      .map((entry) => parseDuplicateSessionIndex(entry.userId || "", baseUserId))
      .filter((value) => Number.isInteger(value))
  );

  let duplicateIndex = 2;
  while (usedIndexes.has(duplicateIndex)) {
    duplicateIndex += 1;
  }

  return {
    effectiveUserId: `${baseUserId}::session-${duplicateIndex}`,
    effectiveUserName: `${baseName} (${duplicateIndex})`,
    duplicateIndex,
  };
}

function logRoomSnapshot(reason, roomId, extra = {}) {
  const ctx = parseRoomContext(roomId);
  const state = roomEditorState.get(roomId);
  console.log(
    `[room-snapshot:${reason}] room=${roomId} gameId=${ctx?.gameId || "none"} groupId=${ctx?.groupId || "none"} instanceId=${state?.instanceId || "none"} roomUsers=${getRoomUsers(roomId).size} members=${JSON.stringify(summarizeRoomMembers(roomId))} extra=${JSON.stringify(extra)}`
  );
}

function sendMessage(socket, type, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type,
      payload,
      ts: Date.now(),
    })
  );
}

function isYjsEnabled() {
  return COLLAB_ENGINE === "yjs";
}

function encodeUpdateToBase64(update) {
  return Buffer.from(update).toString("base64");
}

function decodeBase64Update(value) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

function encodeYjsProtocolPayload(encoder) {
  return Buffer.from(encoding.toUint8Array(encoder)).toString("base64");
}

function getRoomYDocGeneration(roomId) {
  return roomYDocGenerations.get(roomId) || 0;
}

function sendYjsProtocol(socket, roomId, channel, encoder) {
  if (encoding.length(encoder) === 0) {
    return;
  }
  sendMessage(socket, "yjs-protocol", {
    roomId,
    groupId: extractGroupIdFromRoomId(roomId),
    channel,
    payloadBase64: encodeYjsProtocolPayload(encoder),
    ts: Date.now(),
  });
}

function broadcastYjsProtocol(roomId, channel, encoder, excludeSocket = null) {
  if (encoding.length(encoder) === 0) {
    return;
  }
  broadcastToRoom(roomId, "yjs-protocol", {
    roomId,
    groupId: extractGroupIdFromRoomId(roomId),
    channel,
    payloadBase64: encodeYjsProtocolPayload(encoder),
    ts: Date.now(),
  }, excludeSocket);
}

function getYTextKey(editorType, levelIndex) {
  return `level:${levelIndex}:${editorType}`;
}

function hydrateYDocFromState(doc, state) {
  doc.transact(() => {
    state.levels.forEach((level, levelIndex) => {
      for (const editorType of EDITOR_TYPES) {
        const text = doc.getText(getYTextKey(editorType, levelIndex));
        const nextValue = typeof level?.code?.[editorType] === "string" ? level.code[editorType] : "";
        if (text.toString() === nextValue) {
          continue;
        }
        text.delete(0, text.length);
        text.insert(0, nextValue);
      }
    });
  }, "hydrate-room-state");
}

function createRoomYDoc(roomId, state, generation = Math.max(getRoomYDocGeneration(roomId), 1)) {
  const existing = roomYDocs.get(roomId);
  if (existing) {
    existing.destroy();
  }

  const doc = new Y.Doc();
  hydrateYDocFromState(doc, state);
  roomYDocs.set(roomId, doc);
  roomYDocGenerations.set(roomId, generation);

  doc.on("update", (update, origin) => {
    const roomState = roomEditorState.get(roomId);
    if (!roomState?.ctx) {
      return;
    }
    markRoomDirty(roomId, roomState.ctx);
    const encoder = encoding.createEncoder();
    syncProtocol.writeUpdate(encoder, update);
    broadcastYjsProtocol(roomId, "sync", encoder, origin instanceof WebSocket ? origin : null);
  });

  return doc;
}

function getOrCreateYDoc(roomId, state) {
  if (!isYjsEnabled()) {
    return null;
  }
  const existing = roomYDocs.get(roomId);
  if (existing) {
    return existing;
  }
  return createRoomYDoc(roomId, state);
}

function syncStateFromYDoc(roomId, state) {
  if (!isYjsEnabled()) {
    return;
  }
  const doc = roomYDocs.get(roomId);
  if (!doc) {
    return;
  }
  state.levels.forEach((level, levelIndex) => {
    for (const editorType of EDITOR_TYPES) {
      level.code[editorType] = doc.getText(getYTextKey(editorType, levelIndex)).toString();
    }
  });
}

function getRoomClientHashes(roomId) {
  if (!roomClientStateHashes.has(roomId)) {
    roomClientStateHashes.set(roomId, new Map());
  }
  return roomClientStateHashes.get(roomId);
}

function pruneRoomClientHashes(roomId, now = Date.now()) {
  const reports = roomClientStateHashes.get(roomId);
  if (!reports) {
    return;
  }
  for (const [clientId, report] of reports.entries()) {
    if (now - report.receivedAt > CLIENT_HASH_TTL_MS) {
      reports.delete(clientId);
    }
  }
  if (reports.size === 0) {
    roomClientStateHashes.delete(roomId);
  }
}

function removeClientStateHash(roomId, clientId) {
  if (!roomId || !clientId) {
    return;
  }
  const reports = roomClientStateHashes.get(roomId);
  if (!reports) {
    return;
  }
  reports.delete(clientId);
  if (reports.size === 0) {
    roomClientStateHashes.delete(roomId);
  }
}

function buildDivergenceKey(roomId, editorType, levelIndex) {
  return `${roomId}:${levelIndex}:${editorType}`;
}

function summarizeHashReports(reports) {
  return reports.map((report) => ({
    clientId: report.clientId,
    userId: report.userId,
    userEmail: report.userEmail,
    engine: report.engine,
    contentHash: report.contentHash,
    contentLength: report.contentLength,
    version: report.version ?? null,
    isFocused: Boolean(report.isFocused),
    isEditable: Boolean(report.isEditable),
    isTyping: Boolean(report.isTyping),
    ageMs: Date.now() - report.receivedAt,
  }));
}

function createCollaborationHealthMessage(roomId, eventType, severity, details = {}, scope = {}) {
  return {
    roomId,
    groupId: extractGroupIdFromRoomId(roomId),
    eventType,
    severity,
    editorType: scope.editorType,
    levelIndex: scope.levelIndex,
    details,
    ts: Date.now(),
  };
}

function broadcastEditorResync(roomId, state, levelIndex) {
  const levelState = state.levels?.[levelIndex];
  if (!levelState) {
    return;
  }
  for (const editorType of EDITOR_TYPES) {
    broadcastToRoom(roomId, "editor-resync", {
      roomId,
      groupId: extractGroupIdFromRoomId(roomId),
      editorType,
      levelIndex,
      content: levelState.code?.[editorType] || "",
      version: levelState.versions?.[editorType] || 0,
      ts: Date.now(),
    });
  }
}

async function forceRoomResync(roomId, editorType, levelIndex, reason) {
  const ctx = parseRoomContext(roomId);
  if (!ctx) {
    return;
  }
  const state = await ensureRoomState(roomId, ctx);
  broadcastToRoom(roomId, "room-state-sync", serializeRoomStateSync(roomId, state));
  if (isYjsEnabled()) {
    const doc = getOrCreateYDoc(roomId, state);
    if (doc) {
      const encoder = encoding.createEncoder();
      syncProtocol.writeSyncStep2(encoder, doc);
      broadcastYjsProtocol(roomId, "sync", encoder);
    }
  } else if (Number.isInteger(levelIndex)) {
    broadcastEditorResync(roomId, state, levelIndex);
  }
  console.warn(
    `[divergence:resync] room=${roomId} editorType=${editorType} levelIndex=${levelIndex} reason=${reason}`
  );
}

async function evaluateClientStateHashes(roomId, report) {
  const now = Date.now();
  pruneRoomClientHashes(roomId, now);
  const reports = Array.from(getRoomClientHashes(roomId).values()).filter((candidate) =>
    candidate.editorType === report.editorType
    && candidate.levelIndex === report.levelIndex
    && now - candidate.receivedAt <= CLIENT_HASH_TTL_MS
  );

  const divergenceKey = buildDivergenceKey(roomId, report.editorType, report.levelIndex);
  if (reports.length < 2) {
    roomDivergenceState.delete(divergenceKey);
    return;
  }

  const uniqueHashes = [...new Set(reports.map((candidate) => candidate.contentHash))];
  if (uniqueHashes.length <= 1) {
    roomDivergenceState.delete(divergenceKey);
    return;
  }

  const quietWindowSatisfied = reports.every((candidate) => {
    const localInputAgeMs = Number.isFinite(candidate.localInputAgeMs) ? candidate.localInputAgeMs : null;
    const remoteApplyAgeMs = Number.isFinite(candidate.remoteApplyAgeMs) ? candidate.remoteApplyAgeMs : null;
    return (
      (localInputAgeMs == null || localInputAgeMs >= DIVERGENCE_PERSIST_MS)
      && (remoteApplyAgeMs == null || remoteApplyAgeMs >= DIVERGENCE_PERSIST_MS)
    );
  });

  const signature = uniqueHashes.sort().join("|");
  const previous = roomDivergenceState.get(divergenceKey) || {
    firstDetectedAt: now,
    lastDetectedAt: now,
    lastSignature: signature,
    repeatCount: 0,
    lastResyncAt: 0,
  };

  const nextState =
    previous.lastSignature === signature
      ? {
          ...previous,
          lastDetectedAt: now,
          repeatCount: previous.repeatCount + 1,
        }
      : {
          ...previous,
          firstDetectedAt: now,
          lastDetectedAt: now,
          lastSignature: signature,
          repeatCount: 1,
        };

  roomDivergenceState.set(divergenceKey, nextState);

  if (!quietWindowSatisfied) {
    console.info(
      `[divergence:transient] room=${roomId} editorType=${report.editorType} levelIndex=${report.levelIndex} signature=${signature}`
    );
    return;
  }

  if (
    nextState.repeatCount < DIVERGENCE_REPEAT_THRESHOLD
    && now - nextState.firstDetectedAt < DIVERGENCE_PERSIST_MS
  ) {
    return;
  }

  const summary = summarizeHashReports(reports);
  console.warn(
    `[divergence:detected] room=${roomId} editorType=${report.editorType} levelIndex=${report.levelIndex} hashes=${JSON.stringify(summary)}`
  );
  broadcastToRoom(roomId, "collaboration-health", createCollaborationHealthMessage(
    roomId,
    "divergence_detected",
    "error",
    {
      participants: summary,
      hashCount: uniqueHashes.length,
      quietWindowSatisfied,
    },
    {
      editorType: report.editorType,
      levelIndex: report.levelIndex,
    },
  ));

  if (now - nextState.lastResyncAt >= DIVERGENCE_RESYNC_COOLDOWN_MS) {
    nextState.lastResyncAt = now;
    roomDivergenceState.set(divergenceKey, nextState);
    await forceRoomResync(roomId, report.editorType, report.levelIndex, "client_hash_mismatch");
  }
}

function broadcastToRoom(roomId, type, payload, excludeSocket = null) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }

  for (const roomSocket of room.keys()) {
    if (roomSocket === excludeSocket) {
      continue;
    }
    sendMessage(roomSocket, type, payload);
  }
}

function clearRoomMemory(roomId) {
  const existingBuffer = roomWriteBuffer.get(roomId);
  if (existingBuffer?.timer) {
    clearTimeout(existingBuffer.timer);
  }
  roomWriteBuffer.delete(roomId);
  roomEditorState.delete(roomId);
  roomLobbyState.delete(roomId);
  roomYDocs.get(roomId)?.destroy();
  roomYDocs.delete(roomId);
  roomYDocGenerations.delete(roomId);
  roomClientStateHashes.delete(roomId);
  for (const key of Array.from(roomDivergenceState.keys())) {
    if (key.startsWith(`${roomId}:`)) {
      roomDivergenceState.delete(key);
    }
  }
}

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

function findDuplicateUsersInGame(gameId, baseUserData) {
  if (!gameId) {
    return [];
  }

  const duplicates = [];
  for (const [candidateRoomId, roomUsers] of rooms.entries()) {
    if (extractGameIdFromRoomId(candidateRoomId) !== gameId) {
      continue;
    }

    for (const entry of roomUsers.values()) {
      if (baseUserData.userId && entry.accountUserId && entry.accountUserId === baseUserData.userId) {
        duplicates.push(entry);
        continue;
      }
      if (baseUserData.userEmail && entry.accountUserEmail && entry.accountUserEmail === baseUserData.userEmail) {
        duplicates.push(entry);
      }
    }
  }

  return duplicates;
}

function isGroupInstanceContext(ctx) {
  return Boolean(ctx && ctx.kind === "instance" && ctx.groupId);
}

function normalizeGroupStartGate(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const readyUserIds = Array.isArray(source.readyUserIds)
    ? [...new Set(source.readyUserIds.filter((entry) => typeof entry === "string" && entry.length > 0))]
    : [];
  const rawReadyUsers =
    source.readyUsers && typeof source.readyUsers === "object" && !Array.isArray(source.readyUsers)
      ? source.readyUsers
      : {};
  const readyUsers = readyUserIds.reduce((acc, userId) => {
    const user = rawReadyUsers[userId];
    const normalizedUser = user && typeof user === "object" && !Array.isArray(user) ? user : {};
    acc[userId] = {
      userId,
      ...(typeof normalizedUser.userName === "string" ? { userName: normalizedUser.userName } : {}),
      ...(typeof normalizedUser.userEmail === "string" ? { userEmail: normalizedUser.userEmail } : {}),
      ...(typeof normalizedUser.userImage === "string" ? { userImage: normalizedUser.userImage } : {}),
      ...(typeof normalizedUser.readyAt === "string" ? { readyAt: normalizedUser.readyAt } : {}),
    };
    return acc;
  }, {});

  return {
    status: source.status === "started" ? "started" : "waiting",
    minReadyCount: GROUP_START_MIN_READY_COUNT,
    readyUserIds,
    readyUsers,
    startedAt: typeof source.startedAt === "string" ? source.startedAt : null,
    startedByUserId: typeof source.startedByUserId === "string" ? source.startedByUserId : null,
  };
}

function ensureGroupStartGate(state) {
  if (!isGroupInstanceContext(state?.ctx)) {
    return null;
  }

  const gate = normalizeGroupStartGate(state.progressData?.groupStartGate);
  state.progressData = {
    ...state.progressData,
    groupStartGate: gate,
  };
  return gate;
}

function ensureLevelTimerStart(levelState, startedAtMs) {
  if (!levelState) {
    return;
  }

  const timeData =
    levelState.meta?.timeData && typeof levelState.meta.timeData === "object" && !Array.isArray(levelState.meta.timeData)
      ? levelState.meta.timeData
      : { startTime: 0, pointAndTime: {} };
  const currentStartTime = Number(timeData.startTime || 0);
  if (currentStartTime > 0) {
    return;
  }

  levelState.meta = {
    ...levelState.meta,
    timeData: {
      ...timeData,
      startTime: startedAtMs,
    },
  };
}

function applyStartedGateToLevels(state) {
  const gate = ensureGroupStartGate(state);
  if (!gate || gate.status !== "started" || !gate.startedAt) {
    return;
  }

  const startedAtMs = Date.parse(gate.startedAt);
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) {
    return;
  }

  const firstLevel = ensureLevelState(state, 0);
  ensureLevelTimerStart(firstLevel, startedAtMs);
}

function serializeGroupStartSync(roomId, state) {
  const gate = ensureGroupStartGate(state);
  if (!gate) {
    return null;
  }

  return {
    roomId,
    groupId: extractGroupIdFromRoomId(roomId),
    gate,
    ts: Date.now(),
  };
}

function serializeRoomStateSync(roomId, state) {
  if (!isYjsEnabled()) {
    syncStateFromYDoc(roomId, state);
  }
  const payload = {
    levels: state.levels.map((level) => (
      isYjsEnabled()
        ? {
            ...level.meta,
            name: level.name,
          }
        : {
            ...serializeLevelState(level),
            versions: { ...level.versions },
          }
    )),
    ts: Date.now(),
  };
  const gate = ensureGroupStartGate(state);
  if (gate) {
    payload.groupStartGate = gate;
  }
  if (isYjsEnabled()) {
    payload.yjsDocGeneration = getRoomYDocGeneration(roomId);
  }
  return payload;
}

function serializeCodeLevels(roomId, state) {
  syncStateFromYDoc(roomId, state);
  const payload = {
    levels: state.levels.map((level) => serializeLevelState(level)),
  };
  const gate = ensureGroupStartGate(state);
  if (gate) {
    payload.groupStartGate = gate;
  }
  return payload;
}

async function ensureRoomState(roomId, ctx) {
  const existing = roomEditorState.get(roomId);
  if (existing) {
    existing.ctx = ctx;
    return existing;
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
  if (shouldPersistNormalizedLevels && finalLevels.length > 0) {
    const result = await saveProgressToDB(ctx, serializeCodeLevels(roomId, nextState));
    if (!result.ok && !result.permanentFailure) {
      markRoomDirty(roomId, ctx);
    }
  }

  return nextState;
}

function getDocumentText(content) {
  return Text.of((content || "").split("\n"));
}

function summarizeEditorPayload(data) {
  const jsonString = typeof data?.changeSetJson === "undefined" ? "" : JSON.stringify(data.changeSetJson);
  return {
    editorType: data?.editorType,
    levelIndex: data?.levelIndex,
    baseVersion: data?.baseVersion,
    nextVersion: data?.nextVersion,
    changeSetLen: jsonString.length,
  };
}

function scheduleFlush(roomId) {
  const buffer = roomWriteBuffer.get(roomId);
  if (!buffer || buffer.timer) {
    return;
  }

  buffer.timer = setTimeout(() => {
    buffer.timer = null;
    flushWriteBuffer(roomId);
  }, WRITE_BUFFER_FLUSH_MS);
}

function markRoomDirty(roomId, ctx) {
  if (!roomWriteBuffer.has(roomId)) {
    roomWriteBuffer.set(roomId, { ctx, timer: null });
  }
  const buffer = roomWriteBuffer.get(roomId);
  buffer.ctx = ctx;
  scheduleFlush(roomId);
}

async function flushWriteBuffer(roomId) {
  const buffer = roomWriteBuffer.get(roomId);
  const state = roomEditorState.get(roomId);

  if (!buffer || !state) {
    if (buffer?.timer) {
      clearTimeout(buffer.timer);
    }
    roomWriteBuffer.delete(roomId);
    return;
  }

  if (buffer.timer) {
    clearTimeout(buffer.timer);
    buffer.timer = null;
  }

  const result = await saveProgressToDB(state.ctx, serializeCodeLevels(roomId, state));

  if (result.ok) {
    roomWriteBuffer.delete(roomId);
    if (!rooms.has(roomId)) {
      roomEditorState.delete(roomId);
      roomYDocs.get(roomId)?.destroy();
      roomYDocs.delete(roomId);
      roomYDocGenerations.delete(roomId);
    }
  } else if (result.permanentFailure) {
    roomWriteBuffer.delete(roomId);
    if (!rooms.has(roomId)) {
      roomEditorState.delete(roomId);
      roomYDocs.get(roomId)?.destroy();
      roomYDocs.delete(roomId);
      roomYDocGenerations.delete(roomId);
    }
    console.warn(`[db-save:drop-room] room=${roomId} gameId=${state.ctx.gameId} reason=not-found`);
  } else {
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

const wsServer = new WebSocketServer({ server: httpServer });

wsServer.on("error", (error) => {
  console.error("[ws-server:error]", error);
});

const handleSocketMessage = createSocketMessageRouter({
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
  isDuplicateGroupUserAllowed,
  resolveDuplicateIdentity,
  broadcastToRoom,
  logRoomSnapshot,
  getOrCreateYDoc,
  decodeBase64Update,
  sendYjsProtocol,
  editorTypes: EDITOR_TYPES,
  getRoomClientHashes,
  evaluateClientStateHashes,
  rooms,
  ensureLevelState,
  getDocumentText,
  summarizeEditorPayload,
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
  roomWriteBuffer,
  saveProgressToDB,
  serializeCodeLevels,
});

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
    try {
      await handleSocketMessage(socket, rawMessage);
    } catch (error) {
      const roomId = getConnectionState(socket)?.roomId || "none";
      console.error(`[socket:message-error] socket=${getConnectionId(socket)} room=${roomId}`, error);
      sendMessage(socket, "error", { error: "Internal server error" });
    }
  });

  socket.on("close", (code, reasonBuffer) => {
    const socketId = getConnectionId(socket);
    const reason = reasonBuffer?.toString?.() || String(code);
    console.log(`[disconnect] socket=${socketId} reason=${reason}`);

    for (const [roomId, userMap] of rooms.entries()) {
      if (userMap.has(socket)) {
        const userData = removeUserFromRoom(roomId, socket);
        if (userData) {
          removeClientStateHash(roomId, userData.clientId);
          broadcastToRoom(roomId, "user-left", {
            userId: userData.userId,
            userEmail: userData.userEmail,
            userName: userData.userName,
          });
          logRoomSnapshot("disconnect", roomId, { by: socketId, reason });
        }
      }
    }
  });
});

async function flushAllBuffers() {
  const promises = [];
  for (const roomId of roomWriteBuffer.keys()) {
    promises.push(flushWriteBuffer(roomId));
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
