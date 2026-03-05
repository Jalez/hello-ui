import { createServer } from "http";
import { Server } from "socket.io";

const PORT = parseInt(process.env.PORT || "3100", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const WS_SERVICE_TOKEN = process.env.WS_SERVICE_TOKEN || "";
const WRITE_BUFFER_FLUSH_MS = 5000;

// In-memory room tracking: roomId -> Map<socketId, userData>
const rooms = new Map();

// Write buffer for debounced DB saves: roomId -> { gameId, queryParams, levels: {[levelIndex]: {html?, css?, js?}}, timer }
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
    // Flush write buffer when room empties
    flushWriteBuffer(roomId);
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

/**
 * Parse game context from room ID.
 * Formats:
 *   group:{groupId}:game:{gameId}
 *   individual:{userId}:game:{gameId}
 */
function parseRoomContext(roomId) {
  if (typeof roomId !== "string") return null;

  const groupMatch = roomId.match(/^group:(.+?):game:(.+)$/);
  if (groupMatch) {
    return { gameId: groupMatch[2], groupId: groupMatch[1], userId: null };
  }

  const individualMatch = roomId.match(/^individual:(.+?):game:(.+)$/);
  if (individualMatch) {
    return { gameId: individualMatch[2], groupId: null, userId: individualMatch[1] };
  }

  return null;
}

/**
 * Build query params string for the instance API based on room context.
 */
function buildInstanceQueryParams(ctx) {
  const params = new URLSearchParams();
  if (ctx.groupId) params.set("groupId", ctx.groupId);
  if (ctx.userId) params.set("userId", ctx.userId);
  return params.toString();
}

/**
 * Fetch saved progress from the DB via the instance API.
 */
async function fetchProgressFromDB(ctx) {
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
    return data?.instance?.progressData ?? null;
  } catch (err) {
    console.error(`[db-fetch:error] url=${url}`, err.message);
    return null;
  }
}

/**
 * Save progress data to the DB via the instance API.
 */
async function saveProgressToDB(ctx, progressData) {
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
      console.error(`[db-save:error] status=${response.status} url=${url}`);
      return false;
    }
    console.log(`[db-save:ok] gameId=${ctx.gameId}`);
    return true;
  } catch (err) {
    console.error(`[db-save:error] url=${url}`, err.message);
    return false;
  }
}

/**
 * Flush the write buffer for a room: merge buffered level edits into existing
 * progress data and PATCH to DB.
 */
async function flushWriteBuffer(roomId) {
  const buffer = roomWriteBuffer.get(roomId);
  if (!buffer || Object.keys(buffer.levels).length === 0) {
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

  const ctx = buffer.ctx;
  // Build the levels array for progressData from the buffer
  // We need to fetch current progress first to merge
  let existingProgress = null;
  try {
    existingProgress = await fetchProgressFromDB(ctx);
  } catch {
    // ignore
  }

  const existingLevels = existingProgress?.levels || [];
  const mergedLevels = [...existingLevels];

  for (const [levelIndex, edits] of Object.entries(buffer.levels)) {
    const idx = parseInt(levelIndex, 10);
    if (!mergedLevels[idx]) {
      mergedLevels[idx] = { name: "", code: { html: "", css: "", js: "" } };
    }
    const existing = mergedLevels[idx];
    mergedLevels[idx] = {
      ...existing,
      code: {
        html: edits.html ?? existing.code?.html ?? "",
        css: edits.css ?? existing.code?.css ?? "",
        js: edits.js ?? existing.code?.js ?? "",
      },
    };
  }

  const progressData = { levels: mergedLevels };
  const ok = await saveProgressToDB(ctx, progressData);

  if (ok) {
    roomWriteBuffer.delete(roomId);
  } else {
    // Retry on next interval
    scheduleFlush(roomId);
  }
}

/**
 * Schedule a debounced flush for a room.
 */
function scheduleFlush(roomId) {
  const buffer = roomWriteBuffer.get(roomId);
  if (!buffer) return;
  if (buffer.timer) return; // Already scheduled

  buffer.timer = setTimeout(() => {
    buffer.timer = null;
    flushWriteBuffer(roomId);
  }, WRITE_BUFFER_FLUSH_MS);
}

/**
 * Buffer an editor change for debounced DB save.
 */
function bufferEditorChange(roomId, ctx, levelIndex, editorType, content) {
  if (!roomWriteBuffer.has(roomId)) {
    roomWriteBuffer.set(roomId, { ctx, levels: {}, timer: null });
  }
  const buffer = roomWriteBuffer.get(roomId);
  if (!buffer.levels[levelIndex]) {
    buffer.levels[levelIndex] = {};
  }
  buffer.levels[levelIndex][editorType] = content;
  scheduleFlush(roomId);
}

// HTTP server with /health endpoint
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

function summarizeEditorPayload(data) {
  const content = data?.changes?.[0];
  return {
    editorType: data?.editorType,
    levelIndex: data?.levelIndex,
    version: data?.version,
    hasContent: typeof content === "string",
    contentLen: typeof content === "string" ? content.length : 0,
  };
}

io.on("connection", (socket) => {
  const { userId, userEmail, userName, userImage, roomId: authRoomId, groupId } = socket.handshake.auth;
  const fallbackRoomId = authRoomId || groupId;

  console.log(`[connect] socket=${socket.id} userId=${userId} user=${userEmail} room=${fallbackRoomId}`);

  // Handle join-game
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

    // Notify others in the room
    socket.to(roomId).emit("user-joined", userData);

    // Send current users to the joining socket
    const currentUsers = Array.from(getRoomUsers(roomId).values());
    socket.emit("current-users", { users: currentUsers });

    // Fetch saved progress from DB and send code-sync
    const ctx = parseRoomContext(roomId);
    if (ctx) {
      // Flush any pending writes first to ensure DB is up-to-date
      await flushWriteBuffer(roomId);

      const progressData = await fetchProgressFromDB(ctx);
      if (progressData?.levels && Array.isArray(progressData.levels)) {
        socket.emit("code-sync", { levels: progressData.levels });
        console.log(
          `[code-sync:emit] room=${roomId} target=${socket.id} levelsCount=${progressData.levels.length}`
        );
      } else {
        console.log(`[code-sync:skip] room=${roomId} target=${socket.id} reason=no-saved-progress`);
      }
    }

    console.log(`[join-game] user=${userData.userEmail} room=${roomId} total=${currentUsers.length}`);
  });

  // Handle leave-game
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

  // Handle cursor events — forward to room
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

  // Handle editor changes — broadcast to room + buffer for DB save
  socket.on("editor-change", (data) => {
    const roomId = data.roomId || data.groupId || fallbackRoomId;
    if (!roomId) return;

    const content = data.changes?.[0];
    const levelIndex = typeof data.levelIndex === "number" ? data.levelIndex : 0;

    if (typeof content === "string") {
      // Buffer for debounced DB save
      const ctx = parseRoomContext(roomId);
      if (ctx) {
        bufferEditorChange(roomId, ctx, levelIndex, data.editorType, content);
      }
      console.log(
        `[editor-change:store] room=${roomId} from=${socket.id} ${JSON.stringify(summarizeEditorPayload(data))}`
      );
    } else {
      console.log(
        `[editor-change:skip] room=${roomId} from=${socket.id} reason=changes[0]-not-string payload=${JSON.stringify(summarizeEditorPayload(data))}`
      );
    }

    const recipients = Math.max((getRoomUsers(roomId).size || 1) - 1, 0);
    console.log(
      `[editor-change:emit] room=${roomId} from=${socket.id} recipients=${recipients} ${JSON.stringify(summarizeEditorPayload(data))}`
    );
    socket.to(roomId).emit("editor-change", data);
  });

  // Handle tab focus — store and broadcast
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

  // Handle typing status — broadcast to room
  socket.on("typing-status", (data) => {
    const roomId = data.roomId || data.groupId || fallbackRoomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room && room.has(socket.id)) {
      const userData = room.get(socket.id);
      userData.isTyping = data.isTyping;
      room.set(socket.id, userData);

      socket.to(roomId).emit("typing-status", {
        roomId,
        groupId: extractGroupIdFromRoomId(roomId),
        clientId: userData.clientId,
        userId: userData.userId,
        userName: userData.userName,
        editorType: data.editorType,
        isTyping: data.isTyping,
        ts: Date.now(),
      });
      console.log(`[typing-status] room=${roomId} from=${socket.id} editorType=${data.editorType} isTyping=${Boolean(data.isTyping)}`);
    }
  });

  // Clean up on disconnect
  socket.on("disconnect", (reason) => {
    console.log(`[disconnect] socket=${socket.id} reason=${reason}`);

    // Remove from all rooms this socket was in
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

// Flush all pending write buffers on shutdown
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
