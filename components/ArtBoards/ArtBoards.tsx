/** @format */
'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { KeyBindings } from "@/components/Editors/KeyBindings";
import ScenarioAdder from "./ScenarioAdder";
import ScenarioRemover from "./ScenarioRemover";
import SidebySideArt from "./SidebySideArt";
import { ScenarioDrawing } from "./Drawboard/ScenarioDrawing";
import { ScenarioModel } from "./ModelBoard/ScenarioModel";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ImageIcon, MousePointer } from "lucide-react";
import { scenario } from "@/types";
import {
  toggleImageInteractivity,
  updateEventSequenceStep,
} from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import PoppingTitle from "@/components/General/PoppingTitle";
import {
  EMPTY_SEQUENCE_RUNTIME_STATE,
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  getEventSequenceScenarioUiKey,
  getEventSequenceRuntimeKey,
  getSequenceRuntimeState,
  isStepStale,
  requestAutoReplay,
  setCreatorPreviewInteractiveForScenario,
  setSelectedEventSequenceStepId,
  setSelectedScenarioIdForLevel,
  subscribeSequenceRuntime,
  useEventSequenceUiState,
} from "@/lib/drawboard/eventSequenceState";
import { EventSequencePanel } from "./Drawboard/EventSequencePanel";
import { useAutoReplaySequence } from "@/lib/drawboard/useAutoReplaySequence";

const EMPTY_SCENARIOS: scenario[] = [];

export const ArtBoards = (): React.ReactNode => {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string | undefined>);
  const isCreatorRoute = pathname?.startsWith("/creator/") ?? false;
  const isCreatorContext = isCreatorRoute;
  const { syncLevelFields } = useLevelMetaSync();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const showHotkeys = level?.showHotkeys ?? false;
  const scenarios = level?.scenarios ?? EMPTY_SCENARIOS;

  const selectedScenario = useMemo(() => {
    if (scenarios.length === 0) {
      return null;
    }

    return scenarios.find((scenario) => scenario.scenarioId === selectedScenarioId)
      ?? scenarios[0];
  }, [scenarios, selectedScenarioId]);

  const selectedScenarioIndex = selectedScenario
    ? scenarios.findIndex((scenario) => scenario.scenarioId === selectedScenario.scenarioId)
    : -1;

  const selectedScenarioDrawingUrl = selectedScenario ? drawingUrls[selectedScenario.scenarioId] : undefined;
  const selectedScenarioPreviewChoice = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedScenario) {
        return undefined;
      }
      return state.creatorPreviewInteractiveByScenario[
        getEventSequenceScenarioUiKey(currentLevel, selectedScenario.scenarioId)
      ];
    }, [currentLevel, selectedScenario]),
  );
  const isSequencePanelOpen = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedScenario) {
        return false;
      }
      return state.panelOpenByScenario[getEventSequenceScenarioUiKey(currentLevel, selectedScenario.scenarioId)] ?? false;
    }, [currentLevel, selectedScenario]),
  );
  const selectedSequenceStepId = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedScenario) {
        return null;
      }
      return state.selectedStepIdByScenario[getEventSequenceScenarioUiKey(currentLevel, selectedScenario.scenarioId)] ?? null;
    }, [currentLevel, selectedScenario]),
  );
  const autoReplayOnMount = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedScenario) {
        return false;
      }
      return state.autoReplayOnMountByScenario[getEventSequenceScenarioUiKey(currentLevel, selectedScenario.scenarioId)] ?? false;
    }, [currentLevel, selectedScenario]),
  );
  const creatorPreviewInteractive = selectedScenario
    ? (selectedScenarioPreviewChoice ?? !selectedScenarioDrawingUrl)
    : false;

  const goToScenario = (nextIndex: number) => {
    const nextScenario = scenarios[nextIndex];
    if (!nextScenario) {
      return;
    }

    setSelectedScenarioId(nextScenario.scenarioId);
  };

  const handleSwitchInteractiveStatic = () => {
    if (isCreatorContext) {
      if (!selectedScenario) return;
      setCreatorPreviewInteractiveForScenario(currentLevel, selectedScenario.scenarioId, !creatorPreviewInteractive);
      return;
    }

    dispatch(toggleImageInteractivity(currentLevel));
    syncLevelFields(currentLevel - 1, ["interactive"]);
  };

  const interactive = level?.interactive ?? false;
  const showSwitch = Boolean(selectedScenario);
  const switchIsInteractive = isCreatorContext ? creatorPreviewInteractive : interactive;
  const selectedRuntimeKey = selectedScenario
    ? getEventSequenceRuntimeKey(currentLevel, selectedScenario.scenarioId, isCreatorContext)
    : null;
  const sequenceRuntime = useSyncExternalStore(
    useCallback(
      (listener) => (selectedRuntimeKey ? subscribeSequenceRuntime(selectedRuntimeKey, listener) : () => {}),
      [selectedRuntimeKey],
    ),
    useCallback(
      () => (selectedRuntimeKey ? getSequenceRuntimeState(selectedRuntimeKey) : EMPTY_SEQUENCE_RUNTIME_STATE),
      [selectedRuntimeKey],
    ),
    useCallback(
      () => (selectedRuntimeKey ? getSequenceRuntimeState(selectedRuntimeKey) : EMPTY_SEQUENCE_RUNTIME_STATE),
      [selectedRuntimeKey],
    ),
  );
  const selectedScenarioSequence = selectedScenario
    ? level?.eventSequence?.byScenarioId?.[selectedScenario.scenarioId] ?? []
    : [];
  const normalizedActiveStepIndex = sequenceRuntime.activeIndex >= selectedScenarioSequence.length ? 0 : sequenceRuntime.activeIndex;
  const effectiveSelectedSequenceStepId = isCreatorContext && isSequencePanelOpen
    ? (selectedSequenceStepId ?? INITIAL_EVENT_SEQUENCE_STEP_ID)
    : selectedSequenceStepId;
  /** In game mode, the active step drives the solution artboard image (no user step-click). */
  const gameActiveStepId = !isCreatorContext && selectedScenarioSequence.length > 0
    ? selectedScenarioSequence[normalizedActiveStepIndex]?.id ?? null
    : null;

  useEffect(() => {
    setSelectedScenarioIdForLevel(currentLevel, selectedScenario?.scenarioId ?? null);
  }, [currentLevel, selectedScenario?.scenarioId]);

  useEffect(() => {
    if (!selectedScenario || !isCreatorContext) {
      return;
    }
    setCreatorPreviewInteractiveForScenario(currentLevel, selectedScenario.scenarioId, creatorPreviewInteractive);
  }, [creatorPreviewInteractive, currentLevel, isCreatorContext, selectedScenario]);

  // Trigger auto-replay on mount when the preference is enabled.
  const autoReplayOnMountFiredRef = useRef(false);
  useEffect(() => {
    if (
      autoReplayOnMount
      && selectedRuntimeKey
      && selectedScenarioSequence.length > 0
      && !autoReplayOnMountFiredRef.current
      && !sequenceRuntime.autoReplay?.running
    ) {
      autoReplayOnMountFiredRef.current = true;
      requestAutoReplay(selectedRuntimeKey, selectedScenarioSequence.length + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReplayOnMount, selectedRuntimeKey, selectedScenarioSequence.length]);

  useAutoReplaySequence({
    runtimeKey: selectedRuntimeKey,
    levelId: currentLevel,
    scenarioId: selectedScenario?.scenarioId ?? null,
    steps: selectedScenarioSequence,
    autoReplay: sequenceRuntime.autoReplay,
  });

  const staleStepIds = useMemo(() => {
    const set = new Set<string>();
    for (const stepId of Object.keys(sequenceRuntime.stepAccuracyVersions)) {
      if (isStepStale(sequenceRuntime, stepId)) {
        set.add(stepId);
      }
    }
    return set;
  }, [sequenceRuntime]);

  // Early return if level doesn't exist - parent handles loading state
  if (!level) {
    return null;
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      {scenarios.length > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2 px-3 pb-3 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={selectedScenarioIndex <= 0}
            onClick={() => goToScenario(selectedScenarioIndex - 1)}
            aria-label="Show previous scenario"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Select
            value={selectedScenario?.scenarioId ?? ""}
            onValueChange={setSelectedScenarioId}
          >
            <SelectTrigger className="h-9 w-full max-w-[260px]">
              <SelectValue placeholder="Select scenario" />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((scenario, index) => (
                <SelectItem key={scenario.scenarioId} value={scenario.scenarioId}>
                  Scenario {index + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={selectedScenarioIndex < 0 || selectedScenarioIndex >= scenarios.length - 1}
            onClick={() => goToScenario(selectedScenarioIndex + 1)}
            aria-label="Show next scenario"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 w-full flex-col">
        {selectedScenario && (isSequencePanelOpen || sequenceRuntime.recordingMode !== "idle" || selectedScenarioSequence.length > 0) ? (
          <div className="flex flex-none justify-center px-3">
            <EventSequencePanel
              creatorMode={isCreatorContext}
              interactivePreview={creatorPreviewInteractive}
              recordingMode={sequenceRuntime.recordingMode}
              steps={selectedScenarioSequence}
              activeStepIndex={normalizedActiveStepIndex}
              stepAccuracies={sequenceRuntime.stepAccuracies}
              staleStepIds={staleStepIds}
              autoReplay={sequenceRuntime.autoReplay}
              onUpdateStep={(stepId, field, value) => {
                dispatch(updateEventSequenceStep({
                  levelId: currentLevel,
                  scenarioId: selectedScenario.scenarioId,
                  stepId,
                  changes: { [field]: value },
                }));
                syncLevelFields(currentLevel - 1, ["eventSequence"]);
              }}
              selectedStepId={effectiveSelectedSequenceStepId ?? gameActiveStepId}
              onSelectStep={(stepId) => setSelectedEventSequenceStepId(currentLevel, selectedScenario.scenarioId, stepId)}
            />
          </div>
        ) : null}
        {selectedScenario ? (
          <section className="relative flex min-h-0 flex-1 w-full items-center justify-center">
            {sequenceRuntime.recordingMode !== "idle" ? (
              <div className="pointer-events-none absolute left-1/2 top-3 z-[90] -translate-x-1/2 rounded-full bg-red-500/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
                Recording
              </div>
            ) : null}
            <SidebySideArt
              key={selectedScenario.scenarioId}
              contents={[
                <ScenarioModel
                  key={`${selectedScenario.scenarioId}-model`}
                  scenario={selectedScenario}
                  creatorMode={isCreatorContext}
                  creatorPreviewInteractive={creatorPreviewInteractive}
                  selectedEventSequenceStepId={effectiveSelectedSequenceStepId ?? gameActiveStepId}
                  eventSequenceScopedTriggers={selectedScenarioSequence.length > 0}
                  registerForNavbarCapture
                />,
                <ScenarioDrawing
                  key={`${selectedScenario.scenarioId}-draw`}
                  scenario={selectedScenario}
                  creatorMode={isCreatorContext}
                  creatorPreviewInteractive={creatorPreviewInteractive}
                  selectedEventSequenceStepId={effectiveSelectedSequenceStepId ?? gameActiveStepId}
                  eventSequenceScopedTriggers={selectedScenarioSequence.length > 0}
                  registerForNavbarCapture
                />,
              ]}
            />
          </section>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
            No scenarios found
          </div>
        )}

        {showHotkeys ? (
          <div className="mt-3 flex justify-center">
            <KeyBindings />
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-0 right-0 z-[100] flex flex-row items-center gap-1 p-2">
        {showSwitch ? (
          <PoppingTitle topTitle={switchIsInteractive ? "Switch to Static" : "Switch to Live"}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleSwitchInteractiveStatic}
              aria-label={switchIsInteractive ? "Switch to static" : "Switch to live"}
            >
              {switchIsInteractive ? <ImageIcon className="h-5 w-5" /> : <MousePointer className="h-5 w-5" />}
            </Button>
          </PoppingTitle>
        ) : null}
        <ScenarioRemover
          scenarioId={selectedScenario?.scenarioId ?? null}
          canRemove={scenarios.length > 1}
        />
        <ScenarioAdder />
      </div>
    </div>
  );
};
