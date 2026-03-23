import test from "node:test";
import assert from "node:assert/strict";
import { readWsConfig } from "./ws-config.mjs";

test("readWsConfig keeps perMessageDeflate enabled by default", () => {
  const config = readWsConfig({});

  assert.equal(config.wsPerMessageDeflate, true);
  assert.equal(config.wsMaxBufferedAmountBytes, 2 * 1024 * 1024);
});

test("readWsConfig applies boolean and integer overrides", () => {
  const config = readWsConfig({
    WS_PERMESSAGE_DEFLATE: "false",
    WS_MAX_BUFFERED_AMOUNT_BYTES: "4096",
    WS_MAX_PAYLOAD_BYTES: "1234",
    WS_UNKNOWN_MESSAGE_LOG_COOLDOWN_MS: "5000",
  });

  assert.equal(config.wsPerMessageDeflate, false);
  assert.equal(config.wsMaxBufferedAmountBytes, 4096);
  assert.equal(config.wsMaxPayloadBytes, 1234);
  assert.equal(config.wsUnknownMessageLogCooldownMs, 5000);
});
