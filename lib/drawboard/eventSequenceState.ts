import { useSyncExternalStore } from "react";

export type EventSequenceRecordingMode = "idle" | "single" | "continuous";
export const INITIAL_EVENT_SEQUENCE_STEP_ID = "__initial__";

export type SequenceRuntimeState = {
  recordingMode: EventSequenceRecordingMode;
  activeIndex: number;
  pendingStepId: string | null;
  stepAccuracies: Record<string, number>;
};

type EventSequenceUiState = {
  selectedScenarioIdsByLevel: Record<number, string | null>;
  creatorPreviewInteractiveByScenario: Record<string, boolean>;
  panelOpenByScenario: Record<string, boolean>;
  selectedStepIdByScenario: Record<string, string | null>;
};

export const EMPTY_SEQUENCE_RUNTIME_STATE: SequenceRuntimeState = {
  recordingMode: "idle",
  activeIndex: 0,
  pendingStepId: null,
  stepAccuracies: {},
};

const sequenceRuntimeStore = new Map<string, SequenceRuntimeState>();
const sequenceRuntimeListeners = new Map<string, Set<() => void>>();

let eventSequenceUiState: EventSequenceUiState = {
  selectedScenarioIdsByLevel: {},
  creatorPreviewInteractiveByScenario: {},
  panelOpenByScenario: {},
  selectedStepIdByScenario: {},
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

export function useEventSequenceUiState<T>(
  selector: (state: EventSequenceUiState) => T,
): T {
  return useSyncExternalStore(
    subscribeEventSequenceUiState,
    () => selector(getEventSequenceUiState()),
    () => selector(getEventSequenceUiState()),
  );
}
