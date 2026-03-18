export function createSocketLivenessMonitor({
  wsServer,
  WebSocket,
  getConnectionId,
  getConnectionState,
  intervalMs = 30000,
  logger = console,
  startInterval = true,
}) {
  const healthBySocket = new WeakMap();

  function markAlive(socket) {
    healthBySocket.set(socket, {
      isAlive: true,
      lastPongAt: Date.now(),
    });
  }

  function trackSocket(socket) {
    markAlive(socket);
    socket.on("pong", () => {
      markAlive(socket);
    });
  }

  function runHeartbeatCheck() {
    for (const socket of wsServer.clients) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue;
      }

      const health = healthBySocket.get(socket) || { isAlive: true, lastPongAt: Date.now() };
      if (health.isAlive === false) {
        const socketId = getConnectionId(socket);
        const roomId = getConnectionState(socket)?.roomId || "none";
        logger.warn(
          `[ws-heartbeat:terminate] socket=${socketId} room=${roomId} reason=missed-pong intervalMs=${intervalMs}`
        );
        try {
          socket.terminate();
        } catch {
          // Ignore terminate races if the socket is already gone.
        }
        continue;
      }

      healthBySocket.set(socket, {
        ...health,
        isAlive: false,
      });

      try {
        socket.ping();
      } catch (error) {
        const socketId = getConnectionId(socket);
        const roomId = getConnectionState(socket)?.roomId || "none";
        logger.warn(
          `[ws-heartbeat:ping-error] socket=${socketId} room=${roomId} message=${error?.message || String(error)}`
        );
        try {
          socket.terminate();
        } catch {
          // Ignore terminate races if the socket is already gone.
        }
      }
    }
  }

  const timer = startInterval ? setInterval(runHeartbeatCheck, intervalMs) : null;
  if (typeof timer?.unref === "function") {
    timer.unref();
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
    }
  }

  return {
    trackSocket,
    runHeartbeatCheck,
    stop,
  };
}

export const SOCKET_LIVENESS_DOC = true;
