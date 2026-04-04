import { useSyncExternalStore } from "react";

export type EventSequenceRecordingMode = "idle" | "single" | "continuous";
export const INITIAL_EVENT_SEQUENCE_STEP_ID = "__initial__";

export type AutoReplayState = {
  running: boolean;
  stepIndex: number;
  totalSteps: number;
};

export type SequenceRuntimeState = {
  recordingMode: EventSequenceRecordingMode;
  activeIndex: number;
  pendingStepId: string | null;
  stepAccuracies: Record<string, number>;
  /** Monotonically increasing counter: bumps on editor/solution/sequence fingerprint changes (not raw capture URL churn). */
  drawingVersion: number;
  /** The `drawingVersion` at which each step's accuracy was last measured. */
  stepAccuracyVersions: Record<string, number>;
  /** Non-null while an auto-replay cycle is in progress. */
  autoReplay: AutoReplayState | null;
};

type EventSequenceUiState = {
  selectedScenarioIdsByLevel: Record<number, string | null>;
  creatorPreviewInteractiveByScenario: Record<string, boolean>;
  panelOpenByScenario: Record<string, boolean>;
  selectedStepIdByScenario: Record<string, string | null>;
  autoReplayOnMountByScenario: Record<string, boolean>;
};

export const EMPTY_SEQUENCE_RUNTIME_STATE: SequenceRuntimeState = {
  recordingMode: "idle",
  activeIndex: 0,
  pendingStepId: null,
  stepAccuracies: {},
  drawingVersion: 0,
  stepAccuracyVersions: {},
  autoReplay: null,
};

const sequenceRuntimeStore = new Map<string, SequenceRuntimeState>();
const sequenceRuntimeListeners = new Map<string, Set<() => void>>();

const AUTO_REPLAY_STORAGE_KEY = "eventSequence:autoReplayOnMount";

function loadAutoReplayOnMount(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(AUTO_REPLAY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function persistAutoReplayOnMount(value: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTO_REPLAY_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* quota exceeded — ignore */
  }
}

let eventSequenceUiState: EventSequenceUiState = {
  selectedScenarioIdsByLevel: {},
  creatorPreviewInteractiveByScenario: {},
  panelOpenByScenario: {},
  selectedStepIdByScenario: {},
  autoReplayOnMountByScenario: loadAutoReplayOnMount(),
};
const eventSequenceUiListeners = new Set<() => void>();

export function getEventSequenceRuntimeKey(
  levelId: number,
  scenarioId: string,
  creatorMode: boolean,
): string {
  return `${levelId}:${scenarioId}:${creatorMode ? "creator" : "game"}`;
}

export function getEventSequenceScenarioUiKey(levelId: number, scenarioId: string): string {
  return `${levelId}:${scenarioId}`;
}

export function getSequenceRuntimeState(key: string): SequenceRuntimeState {
  return sequenceRuntimeStore.get(key) ?? EMPTY_SEQUENCE_RUNTIME_STATE;
}

export function subscribeSequenceRuntime(key: string, listener: () => void) {
  const listeners = sequenceRuntimeListeners.get(key) ?? new Set<() => void>();
  listeners.add(listener);
  sequenceRuntimeListeners.set(key, listeners);
  return () => {
    const current = sequenceRuntimeListeners.get(key);
    current?.delete(listener);
    if (current && current.size === 0) {
      sequenceRuntimeListeners.delete(key);
    }
  };
}

export function updateSequenceRuntimeState(
  key: string,
  updater: (current: SequenceRuntimeState) => SequenceRuntimeState,
) {
  const next = updater(getSequenceRuntimeState(key));
  sequenceRuntimeStore.set(key, next);
  sequenceRuntimeListeners.get(key)?.forEach((listener) => listener());
}

export function resetSequenceRuntimeState(key: string) {
  sequenceRuntimeStore.set(key, EMPTY_SEQUENCE_RUNTIME_STATE);
  sequenceRuntimeListeners.get(key)?.forEach((listener) => listener());
}

export function subscribeEventSequenceUiState(listener: () => void) {
  eventSequenceUiListeners.add(listener);
  return () => {
    eventSequenceUiListeners.delete(listener);
  };
}

export function getEventSequenceUiState(): EventSequenceUiState {
  return eventSequenceUiState;
}

function updateEventSequenceUiState(
  updater: (current: EventSequenceUiState) => EventSequenceUiState,
) {
  eventSequenceUiState = updater(eventSequenceUiState);
  eventSequenceUiListeners.forEach((listener) => listener());
}

export function setSelectedScenarioIdForLevel(levelId: number, scenarioId: string | null) {
  updateEventSequenceUiState((current) => ({
    ...current,
    selectedScenarioIdsByLevel: {
      ...current.selectedScenarioIdsByLevel,
      [levelId]: scenarioId,
    },
  }));
}

export function setCreatorPreviewInteractiveForScenario(
  levelId: number,
  scenarioId: string,
  interactive: boolean,
) {
  const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
  updateEventSequenceUiState((current) => ({
    ...current,
    creatorPreviewInteractiveByScenario: {
      ...current.creatorPreviewInteractiveByScenario,
      [key]: interactive,
    },
  }));
}

export function setEventSequencePanelOpen(
  levelId: number,
  scenarioId: string,
  open: boolean,
) {
  const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
  updateEventSequenceUiState((current) => ({
    ...current,
    panelOpenByScenario: {
      ...current.panelOpenByScenario,
      [key]: open,
    },
  }));
}

export function setSelectedEventSequenceStepId(
  levelId: number,
  scenarioId: string,
  stepId: string | null,
) {
  const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
  updateEventSequenceUiState((current) => ({
    ...current,
    selectedStepIdByScenario: {
      ...current.selectedStepIdByScenario,
      [key]: stepId,
    },
  }));
}

export function setAutoReplayOnMount(
  levelId: number,
  scenarioId: string,
  enabled: boolean,
) {
  const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
  updateEventSequenceUiState((current) => {
    const next = { ...current.autoReplayOnMountByScenario, [key]: enabled };
    persistAutoReplayOnMount(next);
    return { ...current, autoReplayOnMountByScenario: next };
  });
}

export function useEventSequenceUiState<T>(
  selector: (state: EventSequenceUiState) => T,
): T {
  return useSyncExternalStore(
    subscribeEventSequenceUiState,
    () => selector(getEventSequenceUiState()),
    () => selector(getEventSequenceUiState()),
  );
}

// ---------------------------------------------------------------------------
// Staleness helpers
// ---------------------------------------------------------------------------

export function isStepStale(state: SequenceRuntimeState, stepId: string): boolean {
  const measuredVersion = state.stepAccuracyVersions[stepId];
  return measuredVersion !== undefined && measuredVersion < state.drawingVersion;
}

// ---------------------------------------------------------------------------
// Auto-replay helpers
// ---------------------------------------------------------------------------

export function requestAutoReplay(key: string, totalSteps: number) {
  updateSequenceRuntimeState(key, (current) => ({
    ...current,
    autoReplay: { running: true, stepIndex: 0, totalSteps },
  }));
}

export function cancelAutoReplay(key: string) {
  updateSequenceRuntimeState(key, (current) => ({
    ...current,
    autoReplay: null,
  }));
}

export function waitForStepAccuracy(
  runtimeKey: string,
  stepId: string,
  timeoutMs = 10_000,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error(`Timeout waiting for event ${stepId} accuracy`));
    }, timeoutMs);

    const check = () => {
      const state = getSequenceRuntimeState(runtimeKey);
      const value = state.stepAccuracies[stepId];
      if (value !== undefined && value !== -1) {
        clearTimeout(timer);
        unsub();
        resolve(value);
      }
    };

    const unsub = subscribeSequenceRuntime(runtimeKey, check);
    check();
  });
}
