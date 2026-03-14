import { createServer } from "http";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { ChangeSet, Text } from "@codemirror/state";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import pg from "pg";
import dotenv from "dotenv";

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
const DIVERGENCE_PERSIST_MS = 2000;
const DIVERGENCE_REPEAT_THRESHOLD = 2;
const DIVERGENCE_RESYNC_COOLDOWN_MS = 5000;
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const dbPool = DATABASE_URL ? new pg.Pool({ connectionString: DATABASE_URL }) : null;

// roomId -> Map<WebSocket, userData>
const rooms = new Map();
const connectionState = new WeakMap();

// roomId -> { ctx, progressData, levels, templateLevels, mapName }
const roomEditorState = new Map();
const roomLobbyState = new Map();
const roomYDocs = new Map();
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
        roomYDocs.delete(roomId);
        roomClientStateHashes.delete(roomId);
      }
    });
  }

  return userData;
}

function isLobbyRoom(roomId) {
  return typeof roomId === "string" && roomId.startsWith("lobby:");
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

function getOrCreateYDoc(roomId, state) {
  if (!isYjsEnabled()) {
    return null;
  }
  const existing = roomYDocs.get(roomId);
  if (existing) {
    return existing;
  }
  const doc = new Y.Doc();
  hydrateYDocFromState(doc, state);
  roomYDocs.set(roomId, doc);
  return doc;
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
      broadcastToRoom(roomId, "yjs-sync", {
        roomId,
        groupId: extractGroupIdFromRoomId(roomId),
        updateBase64: encodeUpdateToBase64(Y.encodeStateAsUpdate(doc)),
        ts: Date.now(),
      });
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
  roomYDocs.delete(roomId);
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

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function parseEnvelope(rawMessage) {
  try {
    const parsed = JSON.parse(rawMessage);
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractGroupIdFromRoomId(roomId) {
  if (typeof roomId !== "string" || !roomId.startsWith("group:")) {
    return undefined;
  }

  const afterPrefix = roomId.slice("group:".length);
  const gameSeparatorIndex = afterPrefix.indexOf(":game:");
  if (gameSeparatorIndex === -1) {
    return afterPrefix || undefined;
  }

  const parsedGroupId = afterPrefix.slice(0, gameSeparatorIndex);
  return parsedGroupId || undefined;
}

function parseRoomContext(roomId) {
  if (typeof roomId !== "string") return null;

  const groupMatch = roomId.match(/^group:(.+?):game:(.+)$/);
  if (groupMatch) {
    return { kind: "instance", gameId: groupMatch[2], groupId: groupMatch[1], userId: null };
  }

  const individualMatch = roomId.match(/^individual:(.+?):game:(.+)$/);
  if (individualMatch) {
    return { kind: "instance", gameId: individualMatch[2], groupId: null, userId: individualMatch[1] };
  }

  const creatorMatch = roomId.match(/^creator:(.+?):map:(.+)$/);
  if (creatorMatch) {
    return {
      kind: "creator",
      gameId: creatorMatch[1],
      mapName: decodeURIComponent(creatorMatch[2]),
      groupId: null,
      userId: null,
    };
  }

  return null;
}

function extractGameIdFromRoomId(roomId) {
  if (typeof roomId !== "string") {
    return null;
  }

  const instanceContext = parseRoomContext(roomId);
  if (instanceContext?.gameId) {
    return instanceContext.gameId;
  }

  const lobbyMatch = roomId.match(/^lobby:.+:game:(.+)$/);
  if (lobbyMatch) {
    return lobbyMatch[1] || null;
  }

  return null;
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

function buildInstanceQueryParams(ctx) {
  if (ctx.kind !== "instance") {
    return "";
  }
  const params = new URLSearchParams();
  params.set("accessContext", "game");
  if (ctx.groupId) params.set("groupId", ctx.groupId);
  if (ctx.userId) params.set("userId", ctx.userId);
  return params.toString();
}

async function fetchInstanceSnapshotFromDB(ctx) {
  const qs = buildInstanceQueryParams(ctx);
  const url = `${API_BASE_URL}/api/games/${ctx.gameId}/instance${qs ? `?${qs}` : ""}`;

  try {
    const response = await fetch(url, {
      headers: {
        "x-ws-service-token": WS_SERVICE_TOKEN,
      },
    });
    if (!response.ok) {
      console.error(`[db-fetch:error] status=${response.status} url=${url}`);
      return null;
    }
    const data = await response.json();
    return {
      instanceId: data?.instance?.id ?? null,
      progressData: data?.instance?.progressData ?? null,
      mapName: typeof data?.mapName === "string" ? data.mapName : "",
    };
  } catch (err) {
    console.error(`[db-fetch:error] url=${url}`, err.message);
    return null;
  }
}

async function saveProgressToDB(ctx, progressData) {
  if (ctx.kind !== "instance") {
    return { ok: true, permanentFailure: false };
  }

  const qs = buildInstanceQueryParams(ctx);
  const url = `${API_BASE_URL}/api/games/${ctx.gameId}/instance${qs ? `?${qs}` : ""}`;

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-ws-service-token": WS_SERVICE_TOKEN,
      },
      body: JSON.stringify({ progressData }),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[db-save:error] status=${response.status} url=${url}${errorText ? ` body=${errorText}` : ""}`);
      return {
        ok: false,
        permanentFailure: response.status === 404,
      };
    }
    console.log(`[db-save:ok] gameId=${ctx.gameId}`);
    return { ok: true, permanentFailure: false };
  } catch (err) {
    console.error(`[db-save:error] url=${url}`, err.message);
    return { ok: false, permanentFailure: false };
  }
}

async function fetchCreatorLevels(ctx) {
  const url = `${API_BASE_URL}/api/maps/levels/${encodeURIComponent(ctx.mapName)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[creator-fetch:error] status=${response.status} url=${url}`);
      return [];
    }

    const levels = await response.json();
    return Array.isArray(levels) ? levels : [];
  } catch (err) {
    console.error(`[creator-fetch:error] url=${url}`, err.message);
    return [];
  }
}

async function fetchLevelsForMapName(mapName) {
  const url = `${API_BASE_URL}/api/maps/levels/${encodeURIComponent(mapName)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[map-fetch:error] status=${response.status} url=${url}`);
      return [];
    }

    const levels = await response.json();
    return Array.isArray(levels) ? levels : [];
  } catch (err) {
    console.error(`[map-fetch:error] url=${url}`, err.message);
    return [];
  }
}

function mergeTemplateAndProgressLevels(templateLevels = [], progressLevels = []) {
  const mergedLevels = [];
  const maxLevelCount = Math.max(templateLevels.length, progressLevels.length);

  for (let levelIndex = 0; levelIndex < maxLevelCount; levelIndex += 1) {
    const templateLevel = templateLevels[levelIndex];
    const progressLevel = progressLevels[levelIndex];

    if (templateLevel && progressLevel && typeof progressLevel === "object") {
      const templateCode =
        templateLevel.code && typeof templateLevel.code === "object" ? templateLevel.code : {};
      const progressCode =
        progressLevel.code && typeof progressLevel.code === "object" ? progressLevel.code : {};

      mergedLevels.push({
        ...templateLevel,
        ...progressLevel,
        name:
          typeof progressLevel.name === "string" && progressLevel.name.length > 0
            ? progressLevel.name
            : templateLevel.name,
        code: {
          html:
            typeof progressCode.html === "string"
              ? progressCode.html
              : (typeof templateCode.html === "string" ? templateCode.html : ""),
          css:
            typeof progressCode.css === "string"
              ? progressCode.css
              : (typeof templateCode.css === "string" ? templateCode.css : ""),
          js:
            typeof progressCode.js === "string"
              ? progressCode.js
              : (typeof templateCode.js === "string" ? templateCode.js : ""),
        },
      });
      continue;
    }

    if (templateLevel) {
      mergedLevels.push(templateLevel);
      continue;
    }

    if (progressLevel && typeof progressLevel === "object") {
      mergedLevels.push(progressLevel);
    }
  }

  return mergedLevels;
}

function createStarterLevel(mapName = "") {
  return {
    name: "template",
    scenarios: [],
    buildingBlocks: { pictures: [], colors: [] },
    code: { html: "", css: "", js: "" },
    solution: { html: "", css: "", js: "" },
    accuracy: 0,
    week: mapName,
    percentageTreshold: 70,
    percentageFullPointsTreshold: 95,
    difficulty: "easy",
    instructions: [],
    question_and_answer: { question: "", answer: "" },
    help: { description: "Start coding!", images: [], usefullCSSProperties: [] },
    timeData: { startTime: 0, pointAndTime: { 0: "0:0", 1: "0:0", 2: "0:0", 3: "0:0", 4: "0:0", 5: "0:0" } },
    events: [],
    interactive: false,
    showScenarioModel: true,
    showHotkeys: false,
    showModelPicture: true,
    lockCSS: false,
    lockHTML: false,
    lockJS: false,
    completed: "",
    points: 0,
    maxPoints: 100,
    confettiSprinkled: false,
  };
}

function createVersionMap(source = {}) {
  return {
    html: Number.isFinite(source?.html) ? source.html : 0,
    css: Number.isFinite(source?.css) ? source.css : 0,
    js: Number.isFinite(source?.js) ? source.js : 0,
  };
}

function createLevelState(level = {}) {
  const { name = "", code = {}, versions = {}, ...meta } = level || {};
  return {
    name: typeof name === "string" ? name : "",
    code: {
      html: typeof code?.html === "string" ? code.html : "",
      css: typeof code?.css === "string" ? code.css : "",
      js: typeof code?.js === "string" ? code.js : "",
    },
    versions: createVersionMap(versions),
    meta,
  };
}

function serializeLevelState(level) {
  return {
    ...level.meta,
    name: level.name,
    code: {
      html: level.code.html,
      css: level.code.css,
      js: level.code.js,
    },
  };
}

function createRoomState(ctx, progressData, options = {}) {
  const { templateLevels = [], mapName = "", instanceId = null } = options;
  const normalizedProgressData =
    progressData && typeof progressData === "object" && !Array.isArray(progressData)
      ? { ...progressData }
      : {};
  const levels = Array.isArray(normalizedProgressData.levels)
    ? normalizedProgressData.levels.map((level) => createLevelState(level))
    : [];
  const normalizedTemplateLevels = Array.isArray(templateLevels)
    ? templateLevels.map((level) => serializeLevelState(createLevelState(level)))
    : [];

  return {
    ctx,
    progressData: normalizedProgressData,
    levels,
    templateLevels: normalizedTemplateLevels,
    mapName: typeof mapName === "string" ? mapName : "",
    instanceId: typeof instanceId === "string" ? instanceId : null,
  };
}

function ensureLevelState(state, levelIndex) {
  if (!state.levels[levelIndex]) {
    state.levels[levelIndex] = createLevelState();
  }
  return state.levels[levelIndex];
}

function serializeRoomStateSync(roomId, state) {
  syncStateFromYDoc(roomId, state);
  const payload = {
    levels: state.levels.map((level) => ({
      ...serializeLevelState(level),
      versions: { ...level.versions },
    })),
    ts: Date.now(),
  };
  const gate = ensureGroupStartGate(state);
  if (gate) {
    payload.groupStartGate = gate;
  }
  return payload;
}

function serializeProgressData(state) {
  return {
    ...state.progressData,
    levels: state.levels.map((level) => serializeLevelState(level)),
  };
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
      roomYDocs.delete(roomId);
    }
  } else if (result.permanentFailure) {
    roomWriteBuffer.delete(roomId);
    if (!rooms.has(roomId)) {
      roomEditorState.delete(roomId);
      roomYDocs.delete(roomId);
    }
    console.warn(`[db-save:drop-room] room=${roomId} gameId=${state.ctx.gameId} reason=not-found`);
  } else {
    scheduleFlush(roomId);
  }
}

const httpServer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
    return;
  }
  if (req.method === "GET" && req.url?.startsWith("/admin/room-members")) {
    const serviceToken = req.headers["x-ws-service-token"];
    if (!WS_SERVICE_TOKEN || serviceToken !== WS_SERVICE_TOKEN) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const roomId = url.searchParams.get("roomId") || "";
    if (!roomId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "roomId is required" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      roomId,
      count: getRoomUsers(roomId).size,
      members: summarizeRoomMembers(roomId),
    }));
    return;
  }
  if (req.method === "POST" && req.url === "/admin/reset-game-instances") {
    (async () => {
      const serviceToken = req.headers["x-ws-service-token"];
      if (!WS_SERVICE_TOKEN || serviceToken !== WS_SERVICE_TOKEN) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      try {
        const body = await readJsonBody(req);
        const gameId = typeof body.gameId === "string" ? body.gameId : "";
        if (!gameId) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "gameId is required" }));
          return;
        }

        const result = invalidateGameInstanceRooms(gameId, {
          deletedCount: Number.isInteger(body.deletedCount) ? body.deletedCount : undefined,
          actorUserId: typeof body.actorUserId === "string" ? body.actorUserId : undefined,
          actorUserEmail: typeof body.actorUserEmail === "string" ? body.actorUserEmail : undefined,
          actorUserName: typeof body.actorUserName === "string" ? body.actorUserName : undefined,
          reason: typeof body.reason === "string" ? body.reason : "creator_reset_all_instances",
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (error) {
        console.error("[admin-reset-game-instances:error]", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to reset active game instances" }));
      }
    })();
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

const wsServer = new WebSocketServer({ server: httpServer });

wsServer.on("error", (error) => {
  console.error("[ws-server:error]", error);
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

  const resolveRoomId = (data) => data?.roomId || data?.groupId || getConnectionState(socket)?.roomId || null;

  socket.on("message", async (rawMessage) => {
    await maybeDelaySocketHandling();
    const envelope = parseEnvelope(rawMessage.toString());
    if (!envelope) {
      sendMessage(socket, "error", { error: "Invalid message" });
      return;
    }

    const data = envelope.payload && typeof envelope.payload === "object" ? envelope.payload : {};
    const socketId = getConnectionId(socket);

    switch (envelope.type) {
      case "join-game": {
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        const gameId = extractGameIdFromRoomId(roomId);

        setConnectionState(socket, { roomId });
        const baseUserData = {
          clientId: data.clientId || socketId,
          userId: data.userId || "",
          userEmail: data.userEmail || "",
          userName: data.userName || undefined,
          userImage: data.userImage || undefined,
          accountUserId: data.userId || "",
          accountUserEmail: data.userEmail || "",
          activeTab: null,
          activeLevelIndex: null,
          isTyping: false,
        };
        const existingDuplicates = findDuplicateUsersInGame(gameId, baseUserData);
        if (gameId && existingDuplicates.length > 0 && !await isDuplicateGroupUserAllowed(gameId)) {
          const conflictingUser = existingDuplicates[0];
          const attemptedLabel = baseUserData.userName || baseUserData.userEmail || "this account";
          const attemptedEmail = baseUserData.userEmail ? ` (${baseUserData.userEmail})` : "";
          const conflictingLabel = conflictingUser.userName || conflictingUser.userEmail || "this account";
          const conflictingEmail = conflictingUser.userEmail ? ` (${conflictingUser.userEmail})` : "";
          const summarizeIdentity = (label, email) => {
            const combined = `${label}${email}`;
            return combined.length > 40 ? `${combined.slice(0, 37)}...` : combined;
          };
          const attemptedSummary = summarizeIdentity(attemptedLabel, attemptedEmail);
          const conflictingSummary = summarizeIdentity(conflictingLabel, conflictingEmail);
          const duplicateError =
            `This browser is being identified as ${JSON.stringify(`${attemptedLabel}${attemptedEmail}`)}, ` +
            `but ${JSON.stringify(`${conflictingLabel}${conflictingEmail}`)} is already connected in this game. ` +
            `Turn group submission off from the A+ navbar setting, or ask the creator to enable duplicate users in Game Settings. ` +
            `Allowing duplicates may cause instability and desyncs.`;
          const duplicateCloseReason =
            `Identified as ${attemptedSummary}; ${conflictingSummary} is already connected.`;
          sendMessage(socket, "error", {
            error: duplicateError,
            code: "duplicate_users_blocked",
            roomId,
            ts: Date.now(),
          });
          setTimeout(() => {
            try {
              socket.close(4008, duplicateCloseReason);
            } catch {
              // Ignore close races if the socket is already gone.
            }
          }, 50);
          return;
        }
        const resolvedIdentity = resolveDuplicateIdentity(roomId, baseUserData);
        const userData = {
          ...baseUserData,
          userId: resolvedIdentity.effectiveUserId,
          userName: resolvedIdentity.effectiveUserName,
          duplicateIndex: resolvedIdentity.duplicateIndex,
        };
        addUserToRoom(roomId, socket, userData);

        broadcastToRoom(roomId, "user-joined", userData, socket);

        const currentUsers = Array.from(getRoomUsers(roomId).values());
        sendMessage(socket, "current-users", { users: currentUsers });
        sendMessage(socket, "identity-assigned", {
          roomId,
          userId: userData.userId,
          userEmail: userData.userEmail,
          userName: userData.userName,
          userImage: userData.userImage,
          accountUserId: userData.accountUserId,
          accountUserEmail: userData.accountUserEmail,
          duplicateIndex: userData.duplicateIndex || 0,
          ts: Date.now(),
        });

        if (ctx) {
          const state = await ensureRoomState(roomId, ctx);
          sendMessage(socket, "room-state-sync", serializeRoomStateSync(roomId, state));
          if (isYjsEnabled()) {
            const doc = getOrCreateYDoc(roomId, state);
            sendMessage(socket, "yjs-sync", {
              roomId,
              groupId: extractGroupIdFromRoomId(roomId),
              updateBase64: encodeUpdateToBase64(Y.encodeStateAsUpdate(doc)),
              ts: Date.now(),
            });
          }
          const groupStartSync = serializeGroupStartSync(roomId, state);
          if (groupStartSync) {
            sendMessage(socket, "group-start-sync", groupStartSync);
          }
          console.log(`[room-state-sync:emit] room=${roomId} target=${socketId} levelsCount=${state.levels.length}`);
        } else if (isLobbyRoom(roomId)) {
          const lobbyState = ensureLobbyState(roomId);
          sendMessage(socket, "lobby-chat-sync", {
            roomId,
            messages: lobbyState.messages,
            ts: Date.now(),
          });
        } else {
          console.log(`[room-state-sync:skip] room=${roomId} target=${socketId} reason=invalid-room-context`);
        }

        console.log(`[join-game] user=${userData.userEmail} room=${roomId} total=${currentUsers.length}`);
        logRoomSnapshot("join", roomId, { by: socketId });
        return;
      }
      case "request-room-state-sync": {
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx) {
          console.log(`[room-state-sync:skip] room=${roomId} target=${socketId} reason=invalid-room-context-request`);
          return;
        }

        const state = await ensureRoomState(roomId, ctx);
        sendMessage(socket, "room-state-sync", serializeRoomStateSync(roomId, state));
        if (isYjsEnabled()) {
          const doc = getOrCreateYDoc(roomId, state);
          sendMessage(socket, "yjs-sync", {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            updateBase64: encodeUpdateToBase64(Y.encodeStateAsUpdate(doc)),
            ts: Date.now(),
          });
        }
        const groupStartSync = serializeGroupStartSync(roomId, state);
        if (groupStartSync) {
          sendMessage(socket, "group-start-sync", groupStartSync);
        }
        console.log(
          `[room-state-sync:emit] room=${roomId} target=${socketId} reason=request levelsCount=${state.levels.length}`
        );
        return;
      }
      case "yjs-sync-request": {
        if (!isYjsEnabled()) {
          return;
        }

        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx) {
          return;
        }

        const state = await ensureRoomState(roomId, ctx);
        const doc = getOrCreateYDoc(roomId, state);
        console.log(`[yjs-sync:emit] room=${roomId} target=${socketId} stateBytes=${Y.encodeStateAsUpdate(doc).byteLength}`);
        sendMessage(socket, "yjs-sync", {
          roomId,
          groupId: extractGroupIdFromRoomId(roomId),
          updateBase64: encodeUpdateToBase64(Y.encodeStateAsUpdate(doc)),
          ts: Date.now(),
        });
        return;
      }
      case "yjs-update": {
        if (!isYjsEnabled()) {
          return;
        }

        const roomId = resolveRoomId(data);
        if (!roomId || typeof data.updateBase64 !== "string" || data.updateBase64.length === 0) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx) {
          return;
        }

        const state = await ensureRoomState(roomId, ctx);
        const doc = getOrCreateYDoc(roomId, state);
        const beforeHtmlLen = state.levels?.[0]?.code?.html?.length ?? 0;
        console.log(`[yjs-update:recv] room=${roomId} socket=${socketId} updateLen=${data.updateBase64.length} beforeHtmlLen=${beforeHtmlLen}`);
        Y.applyUpdate(doc, decodeBase64Update(data.updateBase64), socketId);
        syncStateFromYDoc(roomId, state);
        const afterHtmlLen = state.levels?.[0]?.code?.html?.length ?? 0;
        markRoomDirty(roomId, ctx);
        console.log(`[yjs-update:broadcast] room=${roomId} socket=${socketId} afterHtmlLen=${afterHtmlLen}`);
        broadcastToRoom(roomId, "yjs-update", {
          roomId,
          groupId: extractGroupIdFromRoomId(roomId),
          updateBase64: data.updateBase64,
          ts: Date.now(),
        }, socket);
        return;
      }
      case "client-state-hash": {
        const roomId = resolveRoomId(data);
        if (
          !roomId
          || !data.clientId
          || !data.userId
          || !EDITOR_TYPES.includes(data.editorType)
          || !Number.isInteger(data.levelIndex)
          || typeof data.contentHash !== "string"
        ) {
          return;
        }

        const report = {
          roomId,
          groupId: extractGroupIdFromRoomId(roomId),
          clientId: data.clientId,
          userId: data.userId,
          userEmail: typeof data.userEmail === "string" ? data.userEmail : "",
          engine: data.engine === "yjs" ? "yjs" : "custom",
          editorType: data.editorType,
          levelIndex: data.levelIndex,
          contentHash: data.contentHash,
          contentLength: Number.isInteger(data.contentLength) ? data.contentLength : 0,
          version: Number.isInteger(data.version) ? data.version : null,
          isFocused: data.isFocused === true,
          isEditable: data.isEditable !== false,
          isTyping: data.isTyping === true,
          localInputAgeMs: Number.isInteger(data.localInputAgeMs) ? data.localInputAgeMs : null,
          remoteApplyAgeMs: Number.isInteger(data.remoteApplyAgeMs) ? data.remoteApplyAgeMs : null,
          receivedAt: Date.now(),
        };
        getRoomClientHashes(roomId).set(report.clientId, report);
        await evaluateClientStateHashes(roomId, report);
        return;
      }
      case "client-health-event": {
        const roomId = resolveRoomId(data);
        if (!roomId || typeof data.eventType !== "string" || !data.clientId || !data.userId) {
          return;
        }
        const severity = data.severity === "error" ? "error" : data.severity === "warn" ? "warn" : "info";
        const logLine =
          `[client-health:${severity}] room=${roomId} clientId=${data.clientId} userId=${data.userId} ` +
          `editorType=${data.editorType || "none"} levelIndex=${Number.isInteger(data.levelIndex) ? data.levelIndex : "none"} ` +
          `event=${data.eventType} details=${JSON.stringify(data.details || {})}`;
        if (severity === "error") {
          console.error(logLine);
        } else if (severity === "warn") {
          console.warn(logLine);
        } else {
          console.log(logLine);
        }
        return;
      }
      case "leave-game": {
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }

        const userData = removeUserFromRoom(roomId, socket);
        setConnectionState(socket, { roomId: null });

        if (userData) {
          broadcastToRoom(
            roomId,
            "user-left",
            {
              userId: userData.userId,
              userEmail: userData.userEmail,
              userName: userData.userName,
            },
            socket
          );
          console.log(`[leave-game] user=${userData.userEmail} room=${roomId}`);
          logRoomSnapshot("leave", roomId, { by: socketId });
        }
        return;
      }
      case "lobby-chat-send": {
        const roomId = resolveRoomId(data);
        if (!roomId || !isLobbyRoom(roomId)) {
          return;
        }

        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (!text) {
          return;
        }

        const lobbyState = ensureLobbyState(roomId);
        const entry = {
          id: randomUUID(),
          userId: typeof data.userId === "string" ? data.userId : "",
          ...(typeof data.userEmail === "string" ? { userEmail: data.userEmail } : {}),
          ...(typeof data.userName === "string" ? { userName: data.userName } : {}),
          ...(typeof data.userImage === "string" ? { userImage: data.userImage } : {}),
          text,
          createdAt: new Date().toISOString(),
        };
        lobbyState.messages = [...lobbyState.messages.slice(-99), entry];

        sendMessage(socket, "lobby-chat-message", entry);
        broadcastToRoom(roomId, "lobby-chat-message", entry, socket);
        return;
      }
      case "canvas-cursor": {
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }
        broadcastToRoom(roomId, "canvas-cursor", data, socket);
        return;
      }
      case "editor-cursor": {
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }
        console.log(
          `[editor-cursor:recv] room=${roomId} from=${socketId} editorType=${data.editorType} levelIndex=${data.levelIndex} selection=${JSON.stringify(data.selection)}`
        );
        broadcastToRoom(roomId, "editor-cursor", data, socket);
        return;
      }
      case "editor-change": {
        if (isYjsEnabled()) {
          return;
        }
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx) {
          return;
        }

        const levelIndex = Number.isInteger(data.levelIndex) ? data.levelIndex : 0;
        const state = await ensureRoomState(roomId, ctx);
        const levelState = ensureLevelState(state, levelIndex);
        const editorType = EDITOR_TYPES.includes(data.editorType) ? data.editorType : "html";
        const currentVersion = levelState.versions[editorType] || 0;

        if (data.baseVersion !== currentVersion) {
          sendMessage(socket, "editor-resync", {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            editorType,
            levelIndex,
            content: levelState.code[editorType],
            version: currentVersion,
            ts: Date.now(),
          });
          console.log(
            `[editor-change:resync] room=${roomId} from=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} editorType=${editorType} levelIndex=${levelIndex} clientBase=${data.baseVersion} serverVersion=${currentVersion} serverContentLen=${levelState.code[editorType].length} roomUsers=${getRoomUsers(roomId).size || 0}`
          );
          return;
        }

        try {
          const changeSet = ChangeSet.fromJSON(data.changeSetJson);
          const nextContent = changeSet.apply(getDocumentText(levelState.code[editorType])).toString();
          const nextVersion = currentVersion + 1;
          const previousContentLength = levelState.code[editorType].length;

          levelState.code[editorType] = nextContent;
          levelState.versions[editorType] = nextVersion;
          markRoomDirty(roomId, ctx);

          const payload = {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            editorType,
            clientId: data.clientId,
            userId: data.userId,
            baseVersion: currentVersion,
            nextVersion,
            changeSetJson: data.changeSetJson,
            levelIndex,
            selection: data.selection,
            ts: Date.now(),
          };

          console.log(`[editor-change:store] room=${roomId} from=${socketId} ${JSON.stringify(summarizeEditorPayload(payload))}`);
          sendMessage(socket, "editor-change-applied", {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            editorType,
            levelIndex,
            nextVersion,
            content: nextContent,
            ts: Date.now(),
          });

          const recipients = Math.max((getRoomUsers(roomId).size || 1) - 1, 0);
          console.log(`[editor-change:emit] room=${roomId} from=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} recipients=${recipients} prevLen=${previousContentLength} nextLen=${nextContent.length} roomUsers=${getRoomUsers(roomId).size || 0} ${JSON.stringify(summarizeEditorPayload(payload))}`);
          broadcastToRoom(roomId, "editor-change", payload, socket);
        } catch (error) {
          sendMessage(socket, "editor-resync", {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            editorType,
            levelIndex,
            content: levelState.code[editorType],
            version: currentVersion,
            ts: Date.now(),
          });
          console.error(
            `[editor-change:error] room=${roomId} from=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} editorType=${editorType} levelIndex=${levelIndex} serverContentLen=${levelState.code[editorType].length} roomUsers=${getRoomUsers(roomId).size || 0} ${error.message}`
          );
        }
        return;
      }
      case "tab-focus": {
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }

        const room = rooms.get(roomId);
        if (room && room.has(socket)) {
          const userData = room.get(socket);
          userData.activeTab = data.editorType;
          userData.activeLevelIndex = Number.isInteger(data.levelIndex) ? data.levelIndex : 0;
          userData.isTyping = false;
          room.set(socket, userData);

          broadcastToRoom(
            roomId,
            "tab-focus",
            {
              roomId,
              groupId: extractGroupIdFromRoomId(roomId),
              clientId: userData.clientId,
              userId: userData.userId,
              userName: userData.userName,
              userImage: userData.userImage,
              editorType: data.editorType,
              levelIndex: userData.activeLevelIndex,
              ts: Date.now(),
            },
            socket
          );
          console.log(`[tab-focus] room=${roomId} from=${socketId} editorType=${data.editorType} levelIndex=${userData.activeLevelIndex}`);
        }
        return;
      }
      case "typing-status": {
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }

        const room = rooms.get(roomId);
        if (room && room.has(socket)) {
          const userData = room.get(socket);
          const nextIsTyping = Boolean(data.isTyping);
          const nextEditorType = data.editorType ?? userData.activeTab ?? null;
          const nextLevelIndex = Number.isInteger(data.levelIndex)
            ? data.levelIndex
            : (Number.isInteger(userData.activeLevelIndex) ? userData.activeLevelIndex : 0);
          const shouldBroadcast =
            userData.isTyping !== nextIsTyping ||
            userData.activeTab !== nextEditorType ||
            userData.activeLevelIndex !== nextLevelIndex;

          if (!shouldBroadcast) {
            return;
          }

          userData.isTyping = nextIsTyping;
          userData.activeTab = nextEditorType;
          userData.activeLevelIndex = nextLevelIndex;
          room.set(socket, userData);

          broadcastToRoom(
            roomId,
            "typing-status",
            {
              roomId,
              groupId: extractGroupIdFromRoomId(roomId),
              clientId: userData.clientId,
              userId: userData.userId,
              userName: userData.userName,
              editorType: nextEditorType,
              levelIndex: nextLevelIndex,
              isTyping: nextIsTyping,
              ts: Date.now(),
            },
            socket
          );
          console.log(`[typing-status] room=${roomId} from=${socketId} editorType=${nextEditorType} levelIndex=${nextLevelIndex} isTyping=${nextIsTyping}`);
        }
        return;
      }
      case "progress-sync": {
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx || ctx.kind !== "instance") {
          return;
        }

        const state = await ensureRoomState(roomId, ctx);
        const incomingProgress =
          data?.progressData && typeof data.progressData === "object" && !Array.isArray(data.progressData)
            ? data.progressData
            : null;
        if (!incomingProgress) {
          return;
        }

        if (isGroupInstanceContext(ctx) && "groupStartGate" in incomingProgress) {
          delete incomingProgress.groupStartGate;
        }

        state.progressData = {
          ...state.progressData,
          ...incomingProgress,
          levels: state.progressData.levels,
        };
        applyStartedGateToLevels(state);

        broadcastToRoom(roomId, "progress-sync", {
          progressData: incomingProgress,
          ts: Date.now(),
        }, socket);
        console.log(`[progress-sync] room=${roomId} from=${socketId} keys=${Object.keys(incomingProgress).join(",")}`);
        if (Array.isArray(state.progressData.levels) && Array.isArray(incomingProgress.levels)) {
          incomingProgress.levels.forEach((incomingLevel, levelIndex) => {
            const previousLevel = state.progressData.levels[levelIndex] || {};
            ["lockHTML", "lockCSS", "lockJS"].forEach((lockKey) => {
              if (typeof incomingLevel?.[lockKey] === "boolean" && incomingLevel[lockKey] !== previousLevel?.[lockKey]) {
                console.log(
                  `[lock-state] room=${roomId} from=${socketId} gameId=${ctx.gameId} groupId=${ctx.groupId || "none"} instanceId=${state.instanceId || "none"} levelIndex=${levelIndex} key=${lockKey} prev=${Boolean(previousLevel?.[lockKey])} next=${Boolean(incomingLevel[lockKey])}`
                );
              }
            });
          });
        }
        return;
      }
      case "group-start-ready":
      case "group-start-unready": {
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!isGroupInstanceContext(ctx)) {
          return;
        }

        const userId = typeof data.userId === "string" ? data.userId : "";
        if (!userId) {
          return;
        }

        const state = await ensureRoomState(roomId, ctx);
        const gate = ensureGroupStartGate(state);
        if (!gate) {
          return;
        }

        if (gate.status === "started") {
          const startedSync = serializeGroupStartSync(roomId, state);
          if (startedSync) {
            sendMessage(socket, "group-start-sync", startedSync);
          }
          return;
        }

        if (envelope.type === "group-start-ready") {
          if (!gate.readyUserIds.includes(userId)) {
            gate.readyUserIds = [...gate.readyUserIds, userId];
          }
          gate.readyUsers = {
            ...gate.readyUsers,
            [userId]: {
              userId,
              ...(typeof data.userName === "string" ? { userName: data.userName } : {}),
              ...(typeof data.userEmail === "string" ? { userEmail: data.userEmail } : {}),
              ...(typeof data.userImage === "string" ? { userImage: data.userImage } : {}),
              readyAt: new Date().toISOString(),
            },
          };
        } else {
          gate.readyUserIds = gate.readyUserIds.filter((entry) => entry !== userId);
          const nextReadyUsers = { ...gate.readyUsers };
          delete nextReadyUsers[userId];
          gate.readyUsers = nextReadyUsers;
        }

        if (gate.readyUserIds.length >= gate.minReadyCount) {
          gate.status = "started";
          gate.startedAt = new Date().toISOString();
          gate.startedByUserId = userId;
          applyStartedGateToLevels(state);
          sendMessage(socket, "room-state-sync", serializeRoomStateSync(roomId, state));
          broadcastToRoom(roomId, "room-state-sync", serializeRoomStateSync(roomId, state), socket);
        }

        state.progressData = {
          ...state.progressData,
          groupStartGate: gate,
        };
        markRoomDirty(roomId, ctx);

        const syncPayload = serializeGroupStartSync(roomId, state);
        if (syncPayload) {
          sendMessage(socket, "group-start-sync", syncPayload);
          broadcastToRoom(roomId, "group-start-sync", syncPayload, socket);
        }

        broadcastToRoom(roomId, "progress-sync", {
          progressData: { groupStartGate: gate },
          ts: Date.now(),
        }, socket);
        sendMessage(socket, "progress-sync", {
          progressData: { groupStartGate: gate },
          ts: Date.now(),
        });
        console.log(
          `[group-start:${envelope.type === "group-start-ready" ? "ready" : "unready"}] room=${roomId} from=${socketId} userId=${userId} readyCount=${gate.readyUserIds.length}/${gate.minReadyCount} status=${gate.status}`
        );
        logRoomSnapshot(envelope.type === "group-start-ready" ? "start-ready" : "start-unready", roomId, {
          by: socketId,
          readyCount: gate.readyUserIds.length,
          status: gate.status,
        });
        return;
      }
      case "reset-room-state": {
        const roomId = resolveRoomId(data);
        if (!roomId) {
          return;
        }

        const ctx = parseRoomContext(roomId);
        if (!ctx || ctx.kind !== "instance") {
          return;
        }

        const room = rooms.get(roomId);
        const resetUser = room?.get(socket) || null;
        const scope = data?.scope === "game" ? "game" : "level";
        const levelIndex = Number.isInteger(data?.levelIndex) ? data.levelIndex : 0;
        const currentState = await ensureRoomState(roomId, ctx);
        console.log(
          `[room-state-reset:start] room=${roomId} by=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} scope=${scope} levelIndex=${levelIndex} levelsCount=${currentState.levels.length} mapName=${currentState.mapName || "none"}`
        );
        // Reset should prefer the latest creator-saved map levels instead of the
        // room's cached template snapshot. Fall back to the cached snapshot only
        // if the refresh fails or returns nothing.
        let templateLevels = currentState.mapName
          ? await fetchLevelsForMapName(currentState.mapName)
          : [];

        if (templateLevels.length === 0) {
          templateLevels = Array.isArray(currentState.templateLevels)
            ? currentState.templateLevels
            : [];
        }
        if (templateLevels.length === 0) {
          console.warn(
            `[room-state-reset:skip] room=${roomId} by=${socketId} reason=no-template-levels scope=${scope} levelIndex=${levelIndex}`
          );
          return;
        }

        const nextState = createRoomState(ctx, serializeProgressData(currentState), {
          templateLevels,
          mapName: currentState.mapName,
        });
        if (scope === "game") {
          nextState.levels = templateLevels.map((templateLevel) => createLevelState(templateLevel));
        } else {
          const templateLevel = templateLevels[levelIndex];
          if (!templateLevel) {
            return;
          }
          nextState.levels[levelIndex] = createLevelState(templateLevel);
        }
        applyStartedGateToLevels(nextState);
        roomEditorState.set(roomId, nextState);
        if (isYjsEnabled()) {
          // Create a fresh Y.Doc to avoid CRDT tombstone/merge conflicts on reset
          const freshDoc = new Y.Doc();
          hydrateYDocFromState(freshDoc, nextState);
          roomYDocs.set(roomId, freshDoc);
        }

        const existingBuffer = roomWriteBuffer.get(roomId);
        if (existingBuffer?.timer) {
          clearTimeout(existingBuffer.timer);
        }
        roomWriteBuffer.delete(roomId);

        const result = await saveProgressToDB(ctx, serializeCodeLevels(roomId, nextState));
        if (!result.ok && !result.permanentFailure) {
          markRoomDirty(roomId, ctx);
        }
        console.log(
          `[room-state-reset:save] room=${roomId} by=${socketId} ok=${result.ok} permanentFailure=${result.permanentFailure} dirty=${!result.ok && !result.permanentFailure} scope=${scope} levelIndex=${levelIndex}`
        );

        const resyncIndices =
          scope === "game"
            ? nextState.levels.map((_, index) => index)
            : [levelIndex];
        if (isYjsEnabled()) {
          const doc = roomYDocs.get(roomId);
          broadcastToRoom(roomId, "yjs-reset", {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            updateBase64: encodeUpdateToBase64(Y.encodeStateAsUpdate(doc)),
            ts: Date.now(),
          });
        } else {
          for (const resyncLevelIndex of resyncIndices) {
            const resyncLevel = nextState.levels[resyncLevelIndex];
            if (!resyncLevel) {
              continue;
            }
            for (const editorType of EDITOR_TYPES) {
              const content = resyncLevel.code[editorType];
              broadcastToRoom(roomId, "editor-resync", {
                roomId,
                groupId: extractGroupIdFromRoomId(roomId),
                editorType,
                levelIndex: resyncLevelIndex,
                content,
                version: resyncLevel.versions[editorType] || 0,
                ts: Date.now(),
              });
              console.log(
                `[room-state-reset:resync] room=${roomId} by=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} editorType=${editorType} levelIndex=${resyncLevelIndex} version=${resyncLevel.versions[editorType] || 0} contentLen=${typeof content === "string" ? content.length : 0}`
              );
            }
          }
        }

        broadcastToRoom(roomId, "room-state-sync", serializeRoomStateSync(roomId, nextState));
        const groupStartSync = serializeGroupStartSync(roomId, nextState);
        if (groupStartSync) {
          broadcastToRoom(roomId, "group-start-sync", groupStartSync);
        }
        const resetNotice = {
          scope,
          levelIndex,
          userId: resetUser?.userId || (typeof data?.userId === "string" ? data.userId : ""),
          ...(typeof resetUser?.userName === "string" && resetUser.userName
            ? { userName: resetUser.userName }
            : {}),
          ...(typeof resetUser?.userEmail === "string" && resetUser.userEmail
            ? { userEmail: resetUser.userEmail }
            : {}),
          at: new Date().toISOString(),
        };
        broadcastToRoom(roomId, "progress-sync", {
          progressData: { resetNotice },
          ts: Date.now(),
        }, socket);
        console.log(`[room-state-sync:emit] room=${roomId} by=${socketId} reason=reset scope=${scope} levelIndex=${levelIndex}`);
        return;
      }
      default:
        return;
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
