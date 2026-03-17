import { logCollaborationStep } from "../log-collaboration-step.mjs";

/**
 * COLLABORATION STEP 15.8:
 * Relay non-code cursor movement across the room so collaborators can see where
 * someone is pointing on the canvas outside the code editor.
 */
async function handleCanvasCursor({ socket, data, resolveRoomId, ctx }) {
  logCollaborationStep("15.8", "handleCanvasCursor", {
    clientId: data?.clientId ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }
  ctx.broadcastToRoom(roomId, "canvas-cursor", data, socket);
}

export const editorHandlers = {
  "canvas-cursor": handleCanvasCursor,
};
