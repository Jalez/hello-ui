import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { verifyWsAuthToken } from "./ws-auth-token.mjs";

test("verifyWsAuthToken accepts a valid room-scoped token", () => {
  process.env.WS_AUTH_SECRET = "test-secret";
  const token = jwt.sign({
    roomId: "group:group-1:game:game-1",
    gameId: "game-1",
    userId: "user-1",
    userEmail: "user@example.com",
    accountUserId: "user-1",
    accountUserEmail: "user@example.com",
    authKind: "session",
  }, process.env.WS_AUTH_SECRET, {
    issuer: "ws-auth",
    audience: "ws-server",
    expiresIn: "5m",
    subject: "user-1",
  });

  const claims = verifyWsAuthToken(token, { roomId: "group:group-1:game:game-1" });

  assert.equal(claims?.userId, "user-1");
  assert.equal(claims?.accountUserEmail, "user@example.com");
});

test("verifyWsAuthToken rejects a token for a different room", () => {
  process.env.WS_AUTH_SECRET = "test-secret";
  const token = jwt.sign({
    roomId: "group:group-1:game:game-1",
    gameId: "game-1",
    userId: "user-1",
    userEmail: "user@example.com",
    accountUserId: "user-1",
    accountUserEmail: "user@example.com",
    authKind: "session",
  }, process.env.WS_AUTH_SECRET, {
    issuer: "ws-auth",
    audience: "ws-server",
    expiresIn: "5m",
    subject: "user-1",
  });

  const claims = verifyWsAuthToken(token, { roomId: "group:group-2:game:game-1" });

  assert.equal(claims, null);
});
