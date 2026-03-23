import test from "node:test";
import assert from "node:assert/strict";
import { createRoomStateService } from "./room-state-service.mjs";

test("ensureRoomState reuses a pending creator-room load", async () => {
  const roomEditorState = new Map();
  const roomWriteBuffer = new Map();
  const roomDivergenceState = new Map();
  const rooms = new Map();
  const createdDocs = [];
  let fetchCount = 0;
  let releaseFetch;

  const fetchPromise = new Promise((resolve) => {
    releaseFetch = () => resolve([{ name: "Level 1", code: { html: "<p>hi</p>", css: "", js: "" } }]);
  });

  const service = createRoomStateService({
    roomEditorState,
    roomWriteBuffer,
    roomDivergenceState,
    rooms,
    editorTypes: ["html", "css", "js"],
    writeBufferQuietMs: 5,
    writeDirtyWarnThreshold: 10,
    fetchCreatorLevels: async () => {
      fetchCount += 1;
      return fetchPromise;
    },
    fetchInstanceSnapshotFromDB: async () => {
      throw new Error("unexpected instance fetch");
    },
    fetchLevelsForMapName: async () => [],
    saveProgressToDB: async () => ({ ok: true }),
    createRoomState: (ctx, progressData, options = {}) => ({
      ctx,
      progressData,
      levels: progressData.levels,
      templateLevels: options.templateLevels || [],
      mapName: options.mapName || "",
      instanceId: options.instanceId || null,
    }),
    createStarterLevel: () => ({ name: "starter", code: { html: "", css: "", js: "" } }),
    mergeTemplateAndProgressLevels: () => [],
    ensureGroupStartGate: () => null,
    applyStartedGateToLevels: () => {},
    getOrCreateYDoc: (roomId, state) => {
      createdDocs.push({ roomId, state });
      return { roomId };
    },
    destroyRoomYResources: () => {},
    serializeCodeLevels: () => ({ levels: [] }),
  });

  const ctx = { kind: "creator", mapName: "demo-map" };
  const pendingA = service.ensureRoomState("creator:room-1", ctx);
  const pendingB = service.ensureRoomState("creator:room-1", ctx);
  releaseFetch();

  const [stateA, stateB] = await Promise.all([pendingA, pendingB]);

  assert.equal(fetchCount, 1);
  assert.equal(stateA, stateB);
  assert.equal(roomEditorState.get("creator:room-1"), stateA);
  assert.equal(createdDocs.length, 1);
  assert.equal(stateA.mapName, "demo-map");
});
