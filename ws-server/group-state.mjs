import { extractGroupIdFromRoomId } from "./room-context.mjs";

export function isGroupInstanceContext(ctx) {
  return Boolean(ctx && ctx.kind === "instance" && ctx.groupId);
}

function normalizeGroupStartGate(value, minReadyCount) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const readyUserIds = Array.isArray(source.readyUserIds)
    ? [...new Set(source.readyUserIds.filter((entry) => typeof entry === "string" && entry.length > 0))]
    : [];
  const rawReadyUsers =
    source.readyUsers && typeof source.readyUsers === "object" && !Array.isArray(source.readyUsers)
      ? source.readyUsers
      : {};
  const readyUsers = readyUserIds.reduce((acc, userId) => {
    const user = rawReadyUsers[userId];
    const normalizedUser = user && typeof user === "object" && !Array.isArray(user) ? user : {};
    acc[userId] = {
      userId,
      ...(typeof normalizedUser.userName === "string" ? { userName: normalizedUser.userName } : {}),
      ...(typeof normalizedUser.userEmail === "string" ? { userEmail: normalizedUser.userEmail } : {}),
      ...(typeof normalizedUser.userImage === "string" ? { userImage: normalizedUser.userImage } : {}),
      ...(typeof normalizedUser.readyAt === "string" ? { readyAt: normalizedUser.readyAt } : {}),
    };
    return acc;
  }, {});

  return {
    status: source.status === "started" ? "started" : "waiting",
    minReadyCount,
    readyUserIds,
    readyUsers,
    startedAt: typeof source.startedAt === "string" ? source.startedAt : null,
    startedByUserId: typeof source.startedByUserId === "string" ? source.startedByUserId : null,
  };
}

export function ensureGroupStartGate(state, minReadyCount) {
  if (!isGroupInstanceContext(state?.ctx)) {
    return null;
  }

  const gate = normalizeGroupStartGate(state.progressData?.groupStartGate, minReadyCount);
  state.progressData = {
    ...state.progressData,
    groupStartGate: gate,
  };
  return gate;
}

function ensureLevelTimerStart(levelState, startedAtMs) {
  if (!levelState) {
    return;
  }

  const timeData =
    levelState.meta?.timeData && typeof levelState.meta.timeData === "object" && !Array.isArray(levelState.meta.timeData)
      ? levelState.meta.timeData
      : { startTime: 0, pointAndTime: {} };
  const currentStartTime = Number(timeData.startTime || 0);
  if (currentStartTime > 0) {
    return;
  }

  levelState.meta = {
    ...levelState.meta,
    timeData: {
      ...timeData,
      startTime: startedAtMs,
    },
  };
}

export function applyStartedGateToLevels(state, minReadyCount, ensureLevelState) {
  const gate = ensureGroupStartGate(state, minReadyCount);
  if (!gate || gate.status !== "started" || !gate.startedAt) {
    return;
  }

  const startedAtMs = Date.parse(gate.startedAt);
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) {
    return;
  }

  const firstLevel = ensureLevelState(state, 0);
  ensureLevelTimerStart(firstLevel, startedAtMs);
}

export function serializeGroupStartSync(roomId, state, minReadyCount) {
  const gate = ensureGroupStartGate(state, minReadyCount);
  if (!gate) {
    return null;
  }

  return {
    roomId,
    groupId: extractGroupIdFromRoomId(roomId),
    gate,
    ts: Date.now(),
  };
}

export function serializeRoomStateSync(roomId, state, opts) {
  const { isYjsEnabled, syncStateFromYDoc, serializeLevelState, getRoomYDocGeneration, minReadyCount } = opts;
  if (isYjsEnabled()) {
    syncStateFromYDoc(roomId, state);
  }
  const payload = {
    levels: state.levels.map((level) => ({
      ...level.meta,
      name: level.name,
    })),
    ts: Date.now(),
  };
  const gate = ensureGroupStartGate(state, minReadyCount);
  if (gate) {
    payload.groupStartGate = gate;
  }
  payload.yjsDocGeneration = getRoomYDocGeneration(roomId);
  return payload;
}

export function serializeCodeLevels(roomId, state, opts) {
  const { syncStateFromYDoc, serializeLevelState, minReadyCount } = opts;
  syncStateFromYDoc(roomId, state);
  const payload = {
    levels: state.levels.map((level) => serializeLevelState(level)),
  };
  const gate = ensureGroupStartGate(state, minReadyCount);
  if (gate) {
    payload.groupStartGate = gate;
  }
  return payload;
}
