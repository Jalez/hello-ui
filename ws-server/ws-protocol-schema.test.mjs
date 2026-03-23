import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSocketHandlerRegistry } from "./socket-router.mjs";
import { knownInboundMessageTypes, validateIncomingEnvelope } from "./ws-protocol-schema.mjs";

test("validateIncomingEnvelope accepts a valid join-game payload", () => {
  const result = validateIncomingEnvelope({
    type: "join-game",
    payload: {
      roomId: "group:room-1:game:game-1",
      clientId: "client-1",
      authToken: "signed-token",
      sessionRole: "active",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.type, "join-game");
  assert.equal(result.value.payload.clientId, "client-1");
});

test("validateIncomingEnvelope rejects a known payload with the wrong shape", () => {
  const result = validateIncomingEnvelope({
    type: "yjs-protocol",
    payload: {
      roomId: "group:room-1:game:game-1",
      channel: "sync",
      payloadBase64: "",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_payload");
  assert.equal(result.type, "yjs-protocol");
});

test("validateIncomingEnvelope keeps unknown message types ignorable", () => {
  const result = validateIncomingEnvelope({
    type: "future-event",
    payload: "unexpected payload shape",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.type, "future-event");
  assert.deepEqual(result.value.payload, {});
});

test("known inbound schemas cover every registered handler message type", () => {
  const handlerTypes = Object.keys(createSocketHandlerRegistry()).sort();

  assert.deepEqual([...knownInboundMessageTypes].sort(), handlerTypes);
});

test("known inbound schemas cover every client-emitted websocket message type", () => {
  const source = readFileSync(
    new URL("../lib/collaboration/hooks/useCollaborationConnection.ts", import.meta.url),
    "utf8",
  );
  const sendMessageTypes = [...source.matchAll(/sendMessage\("([^"]+)"/g)].map((match) => match[1]);
  const directSocketTypes = [
    ...source.matchAll(/socket\.send\(\s*JSON\.stringify\(\s*\{\s*type:\s*"([^"]+)"/gms),
  ].map((match) => match[1]);
  const emittedTypes = [...new Set([...sendMessageTypes, ...directSocketTypes])].sort();

  assert.deepEqual(emittedTypes, [...knownInboundMessageTypes].sort());
});
