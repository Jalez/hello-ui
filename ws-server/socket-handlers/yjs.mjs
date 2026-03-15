import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import { extractGroupIdFromRoomId, parseRoomContext } from "../room-context.mjs";

/**
 * @typedef {import("../ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */

async function handleYjsProtocol({ socket, data, socketId, resolveRoomId, ctx }) {
  if (!ctx.isYjsEnabled()) {
    return;
  }

  const roomId = resolveRoomId(socket, data);
  if (
    !roomId
    || (data.channel !== "sync" && data.channel !== "awareness")
    || typeof data.payloadBase64 !== "string"
    || data.payloadBase64.length === 0
  ) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);
  if (!roomCtx) {
    return;
  }

  const state = await ctx.ensureRoomState(roomId, roomCtx);
  const payload = ctx.decodeBase64Update(data.payloadBase64);
  if (data.channel === "awareness") {
    const awarenessDecoder = decoding.createDecoder(payload);
    const awarenessUpdate = decoding.readVarUint8Array(awarenessDecoder);
    ctx.applyYjsAwarenessUpdate(roomId, state, awarenessUpdate, socket);
    console.log(
      `[yjs-protocol:recv] room=${roomId} socket=${socketId} channel=awareness payloadLen=${data.payloadBase64.length}`
    );
    return;
  }

  const doc = ctx.getOrCreateYDoc(roomId, state);
  const decoder = decoding.createDecoder(payload);
  const encoder = encoding.createEncoder();
  const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, socket);
  console.log(
    `[yjs-protocol:recv] room=${roomId} socket=${socketId} channel=sync messageType=${syncMessageType} payloadLen=${data.payloadBase64.length}`
  );
  if (encoding.length(encoder) > 0) {
    ctx.sendYjsProtocol(socket, roomId, "sync", encoder);
  }
}

async function handleClientStateHash({ socket, data, resolveRoomId, ctx }) {
  const roomId = resolveRoomId(socket, data);
  if (
    !roomId
    || !data.clientId
    || !data.userId
    || !ctx.editorTypes.includes(data.editorType)
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
    engine: "yjs",
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
  ctx.getRoomClientHashes(roomId).set(report.clientId, report);
  await ctx.evaluateClientStateHashes(roomId, report);
}

async function handleClientHealthEvent({ socket, data, resolveRoomId }) {
  const roomId = resolveRoomId(socket, data);
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
}

export const yjsHandlers = {
  "yjs-protocol": handleYjsProtocol,
  "client-state-hash": handleClientStateHash,
  "client-health-event": handleClientHealthEvent,
};
