import test from "node:test";
import assert from "node:assert/strict";
import { createHttpRequestHandler } from "./http-routes.mjs";

function createResponse() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body = "") {
      this.body = body;
    },
  };
}

test("http-routes returns websocket stats from the authenticated admin endpoint", () => {
  const handler = createHttpRequestHandler({
    port: 3100,
    wsServiceToken: "secret",
    rooms: new Map(),
    readJsonBody: async () => ({}),
    summarizeRoomMembers: () => [],
    invalidateGameInstanceRooms: () => ({}),
    getWsStats: () => ({
      rooms: 3,
      sockets: 9,
      transport: { unknownInboundMessages: 2 },
    }),
  });
  const res = createResponse();

  handler({
    method: "GET",
    url: "/admin/ws-stats",
    headers: { "x-ws-service-token": "secret" },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    rooms: 3,
    sockets: 9,
    transport: { unknownInboundMessages: 2 },
  });
});

test("http-routes rejects websocket stats requests without the service token", () => {
  const handler = createHttpRequestHandler({
    port: 3100,
    wsServiceToken: "secret",
    rooms: new Map(),
    readJsonBody: async () => ({}),
    summarizeRoomMembers: () => [],
    invalidateGameInstanceRooms: () => ({}),
    getWsStats: () => ({}),
  });
  const res = createResponse();

  handler({
    method: "GET",
    url: "/admin/ws-stats",
    headers: {},
  }, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(JSON.parse(res.body), { error: "Unauthorized" });
});
