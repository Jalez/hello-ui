import { randomUUID } from "crypto";
import { isLobbyRoom } from "../room-context.mjs";

/**
 * @typedef {import("../ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */

async function handleLobbyChatSend({ socket, data, resolveRoomId, ctx }) {
  const roomId = resolveRoomId(socket, data);
  if (!roomId || !isLobbyRoom(roomId)) {
    return;
  }

  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text) {
    return;
  }

  const lobbyState = ctx.ensureLobbyState(roomId);
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

  ctx.sendMessage(socket, "lobby-chat-message", entry);
  ctx.broadcastToRoom(roomId, "lobby-chat-message", entry, socket);
}

export const lobbyHandlers = {
  "lobby-chat-send": handleLobbyChatSend,
};
