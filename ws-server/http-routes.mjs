import { URL } from "url";

export function createHttpRequestHandler({
  port,
  wsServiceToken,
  rooms,
  readJsonBody,
  summarizeRoomMembers,
  invalidateGameInstanceRooms,
  getWsStats,
}) {
  return (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
      return;
    }
    if (req.method === "GET" && req.url?.startsWith("/admin/room-members")) {
      const serviceToken = req.headers["x-ws-service-token"];
      if (!wsServiceToken || serviceToken !== wsServiceToken) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      const url = new URL(req.url, `http://localhost:${port}`);
      const roomId = url.searchParams.get("roomId") || "";
      if (!roomId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "roomId is required" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        roomId,
        count: rooms.get(roomId)?.size || 0,
        members: summarizeRoomMembers(roomId),
      }));
      return;
    }
    if (req.method === "POST" && req.url === "/admin/reset-game-instances") {
      (async () => {
        const serviceToken = req.headers["x-ws-service-token"];
        if (!wsServiceToken || serviceToken !== wsServiceToken) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }

        try {
          const body = await readJsonBody(req);
          const gameId = typeof body.gameId === "string" ? body.gameId : "";
          if (!gameId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "gameId is required" }));
            return;
          }

          const result = invalidateGameInstanceRooms(gameId, {
            deletedCount: Number.isInteger(body.deletedCount) ? body.deletedCount : undefined,
            actorUserId: typeof body.actorUserId === "string" ? body.actorUserId : undefined,
            actorUserEmail: typeof body.actorUserEmail === "string" ? body.actorUserEmail : undefined,
            actorUserName: typeof body.actorUserName === "string" ? body.actorUserName : undefined,
            reason: typeof body.reason === "string" ? body.reason : "creator_reset_all_instances",
          });

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, ...result }));
        } catch (error) {
          console.error("[admin-reset-game-instances:error]", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Failed to reset active game instances" }));
        }
      })();
      return;
    }
    if (req.method === "GET" && req.url === "/admin/ws-stats") {
      const serviceToken = req.headers["x-ws-service-token"];
      if (!wsServiceToken || serviceToken !== wsServiceToken) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(typeof getWsStats === "function" ? getWsStats() : {
        rooms: rooms.size,
        sockets: Array.from(rooms.values()).reduce((total, room) => total + room.size, 0),
        transport: null,
      }));
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  };
}
