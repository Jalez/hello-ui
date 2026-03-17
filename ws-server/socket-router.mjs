import { editorHandlers } from "./socket-handlers/editor.mjs";
import { lobbyHandlers } from "./socket-handlers/lobby.mjs";
import { logCollaborationStep } from "./log-collaboration-step.mjs";
import { progressHandlers } from "./socket-handlers/progress.mjs";
import { sessionHandlers } from "./socket-handlers/session.mjs";
import { yjsHandlers } from "./socket-handlers/yjs.mjs";

/**
 * @typedef {import("./ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */

/**
 * COLLABORATION STEP 7.3:
 * Build the lookup table that maps incoming websocket message types to the
 * server function responsible for handling that collaboration step.
 */
export function createSocketHandlerRegistry() {
  logCollaborationStep("7.3", "createSocketHandlerRegistry");
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
/**
 * COLLABORATION STEP 7.4:
 * Create the server-side websocket router. In plain language, this is the traffic
 * controller that validates each incoming packet and forwards it to the correct
 * collaboration handler.
 */
export function createSocketMessageRouter(ctx, options = {}) {
  logCollaborationStep("7.4", "createSocketMessageRouter");
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
