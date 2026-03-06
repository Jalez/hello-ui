import { createServer } from "http";
import { Server } from "socket.io";
import { ChangeSet, Text } from "@codemirror/state";

const PORT = parseInt(process.env.PORT || "3100", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const WS_SERVICE_TOKEN = process.env.WS_SERVICE_TOKEN || "";
const WRITE_BUFFER_FLUSH_MS = 5000;
const EDITOR_TYPES = ["html", "css", "js"];

// roomId -> Map<socketId, userData>
const rooms = new Map();

// roomId -> { ctx, progressData, levels, templateLevels, mapName }
const roomEditorState = new Map();

// roomId -> { ctx, timer }
const roomWriteBuffer = new Map();

function getRoomUsers(roomId) {
  return rooms.get(roomId) || new Map();
}

function addUserToRoom(roomId, socketId, userData) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  rooms.get(roomId).set(socketId, userData);
}

function removeUserFromRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const userData = room.get(socketId);
  room.delete(socketId);

  if (room.size === 0) {
    rooms.delete(roomId);
    flushWriteBuffer(roomId).finally(() => {
      if (!rooms.has(roomId) && !roomWriteBuffer.has(roomId)) {
        roomEditorState.delete(roomId);
      }
    });
  }

  return userData;
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

function buildInstanceQueryParams(ctx) {
  if (ctx.kind !== "instance") {
    return "";
  }
  const params = new URLSearchParams();
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
    return true;
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
      return false;
    }
    console.log(`[db-save:ok] gameId=${ctx.gameId}`);
    return true;
  } catch (err) {
    console.error(`[db-save:error] url=${url}`, err.message);
    return false;
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
  const { templateLevels = [], mapName = "" } = options;
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
  };
}

function ensureLevelState(state, levelIndex) {
  if (!state.levels[levelIndex]) {
    state.levels[levelIndex] = createLevelState();
  }
  return state.levels[levelIndex];
}

function serializeRoomStateSync(state) {
  return {
    levels: state.levels.map((level) => ({
      ...serializeLevelState(level),
      versions: { ...level.versions },
    })),
    ts: Date.now(),
  };
}

function serializeProgressData(state) {
  return {
    ...state.progressData,
    levels: state.levels.map((level) => serializeLevelState(level)),
  };
}

function serializeCodeLevels(state) {
  return {
    levels: state.levels.map((level) => serializeLevelState(level)),
  };
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
    });
    roomEditorState.set(roomId, nextState);
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

  const nextState = createRoomState(
    ctx,
    {
      ...progressData,
      levels: normalizedLevels,
    },
    {
      templateLevels,
      mapName,
    }
  );

  roomEditorState.set(roomId, nextState);

  const shouldPersistNormalizedLevels =
    JSON.stringify(progressLevels) !== JSON.stringify(normalizedLevels);
  if (shouldPersistNormalizedLevels && normalizedLevels.length > 0) {
    const ok = await saveProgressToDB(ctx, serializeCodeLevels(nextState));
    if (!ok) {
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

  const ok = await saveProgressToDB(state.ctx, serializeCodeLevels(state));

  if (ok) {
    roomWriteBuffer.delete(roomId);
    if (!rooms.has(roomId)) {
      roomEditorState.delete(roomId);
    }
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
  res.writeHead(404);
  res.end("Not found");
});

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  const { userId, userEmail, userName, userImage, roomId: authRoomId, groupId } = socket.handshake.auth;
  const fallbackRoomId = authRoomId || groupId;

  console.log(`[connect] socket=${socket.id} userId=${userId} user=${userEmail} room=${fallbackRoomId}`);

  socket.on("join-game", async (data) => {
    const roomId = data.roomId || data.groupId || fallbackRoomId;
    if (!roomId) return;

    socket.join(roomId);

    const userData = {
      clientId: data.clientId || socket.id,
      userId: data.userId || userId,
      userEmail: data.userEmail || userEmail,
      userName: data.userName || userName,
      userImage: data.userImage || userImage,
      activeTab: null,
      isTyping: false,
    };
    addUserToRoom(roomId, socket.id, userData);

    socket.to(roomId).emit("user-joined", userData);

    const currentUsers = Array.from(getRoomUsers(roomId).values());
    socket.emit("current-users", { users: currentUsers });

    const ctx = parseRoomContext(roomId);
    if (ctx) {
      const state = await ensureRoomState(roomId, ctx);
      socket.emit("room-state-sync", serializeRoomStateSync(state));
      console.log(`[room-state-sync:emit] room=${roomId} target=${socket.id} levelsCount=${state.levels.length}`);
    } else {
      console.log(`[room-state-sync:skip] room=${roomId} target=${socket.id} reason=invalid-room-context`);
    }

    console.log(`[join-game] user=${userData.userEmail} room=${roomId} total=${currentUsers.length}`);
  });

  socket.on("leave-game", (data) => {
    const roomId = data?.roomId || data?.groupId || fallbackRoomId;
    if (!roomId) return;

    const userData = removeUserFromRoom(roomId, socket.id);
    socket.leave(roomId);

    if (userData) {
      socket.to(roomId).emit("user-left", {
        userId: userData.userId,
        userEmail: userData.userEmail,
        userName: userData.userName,
      });
      console.log(`[leave-game] user=${userData.userEmail} room=${roomId}`);
    }
  });

  socket.on("canvas-cursor", (data) => {
    const roomId = data.roomId || data.groupId || fallbackRoomId;
    if (!roomId) return;
    socket.to(roomId).emit("canvas-cursor", data);
  });

  socket.on("editor-cursor", (data) => {
    const roomId = data.roomId || data.groupId || fallbackRoomId;
    if (!roomId) return;
    console.log(
      `[editor-cursor:recv] room=${roomId} from=${socket.id} editorType=${data.editorType} selection=${JSON.stringify(data.selection)}`
    );
    socket.to(roomId).emit("editor-cursor", data);
  });

  socket.on("editor-change", async (data) => {
    const roomId = data.roomId || data.groupId || fallbackRoomId;
    if (!roomId) return;

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
      socket.emit("editor-resync", {
        roomId,
        groupId: extractGroupIdFromRoomId(roomId),
        editorType,
        levelIndex,
        content: levelState.code[editorType],
        version: currentVersion,
        ts: Date.now(),
      });
      console.log(
        `[editor-change:resync] room=${roomId} from=${socket.id} editorType=${editorType} levelIndex=${levelIndex} clientBase=${data.baseVersion} serverVersion=${currentVersion}`
      );
      return;
    }

    try {
      const changeSet = ChangeSet.fromJSON(data.changeSetJson);
      const nextContent = changeSet.apply(getDocumentText(levelState.code[editorType])).toString();
      const nextVersion = currentVersion + 1;

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

      console.log(`[editor-change:store] room=${roomId} from=${socket.id} ${JSON.stringify(summarizeEditorPayload(payload))}`);
      socket.emit("editor-change-applied", {
        roomId,
        groupId: extractGroupIdFromRoomId(roomId),
        editorType,
        levelIndex,
        nextVersion,
        ts: Date.now(),
      });

      const recipients = Math.max((getRoomUsers(roomId).size || 1) - 1, 0);
      console.log(`[editor-change:emit] room=${roomId} from=${socket.id} recipients=${recipients} ${JSON.stringify(summarizeEditorPayload(payload))}`);
      socket.to(roomId).emit("editor-change", payload);
    } catch (error) {
      socket.emit("editor-resync", {
        roomId,
        groupId: extractGroupIdFromRoomId(roomId),
        editorType,
        levelIndex,
        content: levelState.code[editorType],
        version: currentVersion,
        ts: Date.now(),
      });
      console.error(
        `[editor-change:error] room=${roomId} from=${socket.id} editorType=${editorType} levelIndex=${levelIndex} ${error.message}`
      );
    }
  });

  socket.on("tab-focus", (data) => {
    const roomId = data.roomId || data.groupId || fallbackRoomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room && room.has(socket.id)) {
      const userData = room.get(socket.id);
      userData.activeTab = data.editorType;
      userData.isTyping = false;
      room.set(socket.id, userData);

      socket.to(roomId).emit("tab-focus", {
        roomId,
        groupId: extractGroupIdFromRoomId(roomId),
        clientId: userData.clientId,
        userId: userData.userId,
        userName: userData.userName,
        userImage: userData.userImage,
        editorType: data.editorType,
        ts: Date.now(),
      });
      console.log(`[tab-focus] room=${roomId} from=${socket.id} editorType=${data.editorType}`);
    }
  });

  socket.on("typing-status", (data) => {
    const roomId = data.roomId || data.groupId || fallbackRoomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room && room.has(socket.id)) {
      const userData = room.get(socket.id);
      const nextIsTyping = Boolean(data.isTyping);
      const nextEditorType = data.editorType ?? userData.activeTab ?? null;
      const shouldBroadcast =
        userData.isTyping !== nextIsTyping || userData.activeTab !== nextEditorType;

      if (!shouldBroadcast) {
        return;
      }

      userData.isTyping = nextIsTyping;
      userData.activeTab = nextEditorType;
      room.set(socket.id, userData);

      socket.to(roomId).emit("typing-status", {
        roomId,
        groupId: extractGroupIdFromRoomId(roomId),
        clientId: userData.clientId,
        userId: userData.userId,
        userName: userData.userName,
        editorType: nextEditorType,
        isTyping: nextIsTyping,
        ts: Date.now(),
      });
      console.log(`[typing-status] room=${roomId} from=${socket.id} editorType=${nextEditorType} isTyping=${nextIsTyping}`);
    }
  });

  socket.on("reset-room-state", async (data) => {
    const roomId = data?.roomId || data?.groupId || fallbackRoomId;
    if (!roomId) return;

    const ctx = parseRoomContext(roomId);
    if (!ctx || ctx.kind !== "instance") {
      return;
    }

    const scope = data?.scope === "game" ? "game" : "level";
    const levelIndex = Number.isInteger(data?.levelIndex) ? data.levelIndex : 0;
    const currentState = await ensureRoomState(roomId, ctx);
    let templateLevels = Array.isArray(currentState.templateLevels)
      ? currentState.templateLevels
      : [];

    if (templateLevels.length === 0 && currentState.mapName) {
      templateLevels = await fetchLevelsForMapName(currentState.mapName);
    }
    if (templateLevels.length === 0) {
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
    roomEditorState.set(roomId, nextState);

    const existingBuffer = roomWriteBuffer.get(roomId);
    if (existingBuffer?.timer) {
      clearTimeout(existingBuffer.timer);
    }
    roomWriteBuffer.delete(roomId);

    const ok = await saveProgressToDB(ctx, serializeCodeLevels(nextState));
    if (!ok) {
      markRoomDirty(roomId, ctx);
    }

    io.to(roomId).emit("room-state-sync", serializeRoomStateSync(nextState));
    console.log(`[room-state-sync:emit] room=${roomId} by=${socket.id} reason=reset scope=${scope} levelIndex=${levelIndex}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[disconnect] socket=${socket.id} reason=${reason}`);

    for (const [roomId, userMap] of rooms.entries()) {
      if (userMap.has(socket.id)) {
        const userData = removeUserFromRoom(roomId, socket.id);
        if (userData) {
          io.to(roomId).emit("user-left", {
            userId: userData.userId,
            userEmail: userData.userEmail,
            userName: userData.userName,
          });
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
