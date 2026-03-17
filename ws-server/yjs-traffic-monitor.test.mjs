import test from "node:test";
import assert from "node:assert/strict";
import { createYjsTrafficMonitor } from "./yjs-traffic-monitor.mjs";

test("warns on repeated identical awareness payloads", () => {
  let currentTime = 0;
  const logs = [];
  const logger = {
    log(message) {
      logs.push({ level: "log", message });
    },
    warn(message) {
      logs.push({ level: "warn", message });
    },
  };
  const monitor = createYjsTrafficMonitor({
    logger,
    now: () => currentTime,
    awarenessRepeatThreshold: 3,
    awarenessRepeatWindowMs: 1000,
    summaryIntervalMs: 10000,
  });

  for (let index = 0; index < 3; index += 1) {
    currentTime += 100;
    monitor.recordAwareness({
      roomId: "room-1",
      socketId: "socket-1",
      payloadBase64: "same-payload",
      payloadLen: 12,
      connectedUsers: 1,
    });
  }

  assert.equal(logs.filter((entry) => entry.level === "warn").length, 1);
  assert.match(logs[0].message, /type=awareness-repeat/);
});

test("summarizes traffic instead of logging every sync packet", () => {
  let currentTime = 0;
  const logs = [];
  const logger = {
    log(message) {
      logs.push({ level: "log", message });
    },
    warn(message) {
      logs.push({ level: "warn", message });
    },
  };
  const monitor = createYjsTrafficMonitor({
    logger,
    now: () => currentTime,
    summaryIntervalMs: 1000,
  });

  monitor.recordSync({
    roomId: "room-1",
    socketId: "socket-1",
    messageType: 2,
    payloadLen: 20,
    connectedUsers: 2,
  });
  currentTime = 1200;
  monitor.recordSync({
    roomId: "room-1",
    socketId: "socket-1",
    messageType: 2,
    payloadLen: 22,
    connectedUsers: 2,
  });

  assert.equal(logs.filter((entry) => entry.level === "log").length, 1);
  assert.match(logs[0].message, /awarenessRecv=0 syncRecv=2/);
  assert.match(logs[0].message, /syncTypes=2:2/);
  assert.match(logs[0].message, /bytesIn=42/);
  assert.equal(logs.filter((entry) => entry.level === "warn").length, 0);
});

test("does not summarize low-volume awareness-only heartbeats", () => {
  let currentTime = 0;
  const logs = [];
  const logger = {
    log(message) {
      logs.push({ level: "log", message });
    },
    warn(message) {
      logs.push({ level: "warn", message });
    },
  };
  const monitor = createYjsTrafficMonitor({
    logger,
    now: () => currentTime,
    summaryIntervalMs: 1000,
    awarenessSummaryThreshold: 5,
  });

  monitor.recordAwareness({
    roomId: "room-1",
    socketId: "socket-1",
    payloadBase64: "heartbeat",
    payloadLen: 10,
    connectedUsers: 1,
  });
  currentTime = 1200;
  monitor.recordAwareness({
    roomId: "room-1",
    socketId: "socket-1",
    payloadBase64: "heartbeat",
    payloadLen: 10,
    connectedUsers: 1,
  });

  assert.equal(logs.filter((entry) => entry.level === "log").length, 0);
  assert.equal(logs.filter((entry) => entry.level === "warn").length, 0);
});

test("still summarizes awareness-only traffic when volume is high", () => {
  let currentTime = 0;
  const logs = [];
  const logger = {
    log(message) {
      logs.push({ level: "log", message });
    },
    warn(message) {
      logs.push({ level: "warn", message });
    },
  };
  const monitor = createYjsTrafficMonitor({
    logger,
    now: () => currentTime,
    summaryIntervalMs: 1000,
    awarenessSummaryThreshold: 3,
  });

  monitor.recordAwareness({
    roomId: "room-1",
    socketId: "socket-1",
    payloadBase64: "heartbeat-a",
    payloadLen: 10,
    connectedUsers: 1,
  });
  monitor.recordAwareness({
    roomId: "room-1",
    socketId: "socket-1",
    payloadBase64: "heartbeat-b",
    payloadLen: 10,
    connectedUsers: 1,
  });
  currentTime = 1200;
  monitor.recordAwareness({
    roomId: "room-1",
    socketId: "socket-1",
    payloadBase64: "heartbeat-c",
    payloadLen: 10,
    connectedUsers: 1,
  });

  assert.equal(logs.filter((entry) => entry.level === "log").length, 1);
  assert.match(logs[0].message, /awarenessRecv=3 syncRecv=0/);
});
