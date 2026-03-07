import { createServer } from "http";
import { randomUUID } from "crypto";
import { ChangeSet, Text } from "@codemirror/state";
import { WebSocketServer, WebSocket } from "ws";

const PORT = parseInt(process.env.PORT || "3100", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const WS_SERVICE_TOKEN = process.env.WS_SERVICE_TOKEN || "";
const WRITE_BUFFER_FLUSH_MS = 5000;
const EDITOR_TYPES = ["html", "css", "js"];

// roomId -> Map<WebSocket, userData>
const rooms = new Map();
const connectionState = new WeakMap();

// roomId -> { ctx, progressData, levels, templateLevels, mapName }
const roomEditorState = new Map();

// roomId -> { ctx, timer }
const roomWriteBuffer = new Map();

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
      }
    });
  }

  return userData;
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
    }
  );

  roomEditorState.set(roomId, nextState);

  const shouldPersistNormalizedLevels =
    JSON.stringify(progressLevels) !== JSON.stringify(finalLevels);
  if (shouldPersistNormalizedLevels && finalLevels.length > 0) {
    const result = await saveProgressToDB(ctx, serializeCodeLevels(nextState));
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

  const result = await saveProgressToDB(state.ctx, serializeCodeLevels(state));

  if (result.ok) {
    roomWriteBuffer.delete(roomId);
    if (!rooms.has(roomId)) {
      roomEditorState.delete(roomId);
    }
  } else if (result.permanentFailure) {
    roomWriteBuffer.delete(roomId);
    if (!rooms.has(roomId)) {
      roomEditorState.delete(roomId);
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
  res.writeHead(404);
  res.end("Not found");
});

const wsServer = new WebSocketServer({ server: httpServer });

wsServer.on("connection", (socket) => {
  setConnectionState(socket, { id: randomUUID(), roomId: null });
  console.log(`[connect] socket=${getConnectionId(socket)}`);

  const resolveRoomId = (data) => data?.roomId || data?.groupId || getConnectionState(socket)?.roomId || null;

  socket.on("message", async (rawMessage) => {
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

        setConnectionState(socket, { roomId });
        const userData = {
          clientId: data.clientId || socketId,
          userId: data.userId || "",
          userEmail: data.userEmail || "",
          userName: data.userName || undefined,
          userImage: data.userImage || undefined,
          activeTab: null,
          activeLevelIndex: null,
          isTyping: false,
        };
        addUserToRoom(roomId, socket, userData);

        broadcastToRoom(roomId, "user-joined", userData, socket);

        const currentUsers = Array.from(getRoomUsers(roomId).values());
        sendMessage(socket, "current-users", { users: currentUsers });

        const ctx = parseRoomContext(roomId);
        if (ctx) {
          const state = await ensureRoomState(roomId, ctx);
          sendMessage(socket, "room-state-sync", serializeRoomStateSync(state));
          console.log(`[room-state-sync:emit] room=${roomId} target=${socketId} levelsCount=${state.levels.length}`);
        } else {
          console.log(`[room-state-sync:skip] room=${roomId} target=${socketId} reason=invalid-room-context`);
        }

        console.log(`[join-game] user=${userData.userEmail} room=${roomId} total=${currentUsers.length}`);
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
        }
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
            `[editor-change:resync] room=${roomId} from=${socketId} editorType=${editorType} levelIndex=${levelIndex} clientBase=${data.baseVersion} serverVersion=${currentVersion}`
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

          console.log(`[editor-change:store] room=${roomId} from=${socketId} ${JSON.stringify(summarizeEditorPayload(payload))}`);
          sendMessage(socket, "editor-change-applied", {
            roomId,
            groupId: extractGroupIdFromRoomId(roomId),
            editorType,
            levelIndex,
            nextVersion,
            ts: Date.now(),
          });

          const recipients = Math.max((getRoomUsers(roomId).size || 1) - 1, 0);
          console.log(`[editor-change:emit] room=${roomId} from=${socketId} recipients=${recipients} ${JSON.stringify(summarizeEditorPayload(payload))}`);
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
            `[editor-change:error] room=${roomId} from=${socketId} editorType=${editorType} levelIndex=${levelIndex} ${error.message}`
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

        state.progressData = {
          ...state.progressData,
          ...incomingProgress,
          levels: state.progressData.levels,
        };

        broadcastToRoom(roomId, "progress-sync", {
          progressData: incomingProgress,
          ts: Date.now(),
        }, socket);
        console.log(`[progress-sync] room=${roomId} from=${socketId} keys=${Object.keys(incomingProgress).join(",")}`);
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

        const result = await saveProgressToDB(ctx, serializeCodeLevels(nextState));
        if (!result.ok && !result.permanentFailure) {
          markRoomDirty(roomId, ctx);
        }

        broadcastToRoom(roomId, "room-state-sync", serializeRoomStateSync(nextState));
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
          broadcastToRoom(roomId, "user-left", {
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
