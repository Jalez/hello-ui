async function handleCanvasCursor({ socket, data, resolveRoomId, ctx }) {
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }
  ctx.broadcastToRoom(roomId, "canvas-cursor", data, socket);
}

export const editorHandlers = {
  "canvas-cursor": handleCanvasCursor,
};
