import { editorHandlers } from "./socket-handlers/editor.mjs";
import { lobbyHandlers } from "./socket-handlers/lobby.mjs";
import { progressHandlers } from "./socket-handlers/progress.mjs";
import { sessionHandlers } from "./socket-handlers/session.mjs";
import { yjsHandlers } from "./socket-handlers/yjs.mjs";

/**
 * @typedef {import("./ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */

export function createSocketHandlerRegistry() {
  return {
    ...sessionHandlers,
    ...yjsHandlers,
    ...editorHandlers,
    ...progressHandlers,
    ...lobbyHandlers,
  };
}

/**
 * @param {WsRuntimeContext} ctx
 * @param {{ handlers?: Record<string, Function> }} [options]
 */
export function createSocketMessageRouter(ctx, options = {}) {
  const handlers = options.handlers || createSocketHandlerRegistry();
  const resolveRoomId = (socket, data) => data?.roomId || data?.groupId || ctx.getConnectionState(socket)?.roomId || null;

  return async (socket, rawMessage) => {
    await ctx.maybeDelaySocketHandling();
    const envelope = ctx.parseEnvelope(rawMessage.toString());
    if (!envelope) {
      ctx.sendMessage(socket, "error", { error: "Invalid message" });
      return;
    }

    const data = envelope.payload && typeof envelope.payload === "object" ? envelope.payload : {};
    const socketId = ctx.getConnectionId(socket);
    const handler = handlers[envelope.type];
    if (!handler) {
      return;
    }

    try {
      await handler({ socket, data, envelope, socketId, resolveRoomId, ctx });
    } catch (error) {
      const roomId = ctx.getConnectionState(socket)?.roomId || "none";
      console.error(`[socket:message-error] socket=${socketId} room=${roomId}`, error);
      ctx.sendMessage(socket, "error", { error: "Internal server error" });
    }
  };
}
