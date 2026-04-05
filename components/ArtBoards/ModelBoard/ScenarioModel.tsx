/** @format */
"use client";

import { Diff } from "./Diff/Diff";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { ModelArtContainer } from "./ModelArtContainer";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { EventSequenceStep, scenario } from "@/types";
import { Image } from "@/components/General/Image/Image";
import {
  DiffModelToggleContent,
  FloatingActionButton,
} from "@/components/General/FloatingActionButton";
import { DraggableFloatingPanel } from "@/components/General/DraggableFloatingPanel";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { toggleShowModelSolution } from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { Button } from "@/components/ui/button";
import PoppingTitle from "@/components/General/PoppingTitle";
import { Camera } from "lucide-react";
import type { FrameHandle } from "@/components/ArtBoards/Frame";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import {
  getEventSequenceRuntimeKey,
  getSequenceRuntimeState,
  subscribeSequenceRuntime,
} from "@/lib/drawboard/eventSequenceState";
import {
  defaultTimelineStepIdForSolutionCapture,
  resolveEventSequenceSolutionUrl,
} from "@/lib/drawboard/eventSequenceSolutionUrls";
import { useEventSequencePreview } from "@/lib/drawboard/useEventSequencePreview";

type ScenarioModelProps = {
  scenario: scenario;
  allowScaling?: boolean;
  /** When true, registers with creator navbar Grade (visible artboards only; not used on player game nav). */
  registerForNavbarCapture?: boolean;
  /** When true, skip snapshot preview fetch (SidebySideArt probes/hidden branches). */
  suppressHeavyLayoutEffects?: boolean;
  creatorPreviewInteractive?: boolean;
  creatorMode?: boolean;
  selectedEventSequenceStepId?: string | null;
  /**
   * Game + event sequence: live gameplay step for per-step solution capture / Redux keys only.
   * `selectedEventSequenceStepId` still drives replay, scrub, and trigger prefix.
   */
  gameplaySolutionStepId?: string | null;
  /** Match ScenarioDrawing: scope interaction triggers to the replay prefix when scrubbing steps. */
  eventSequenceScopedTriggers?: boolean;
};

const EMPTY_EVENT_SEQUENCE: EventSequenceStep[] = [];

export const ScenarioModel = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
  creatorPreviewInteractive,
  creatorMode,
  selectedEventSequenceStepId,
  gameplaySolutionStepId = null,
  eventSequenceScopedTriggers = false,
}: ScenarioModelProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const showModel = level.showModelPicture;
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();
  const scenarioSequence = level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? EMPTY_EVENT_SEQUENCE;
  const options = useAppSelector((state) => state.options);
  const isCreator = creatorMode ?? options.creator;
  const usePerStepSolutionKeys = !isCreator && scenarioSequence.length > 0;
  const solutionStepIdForCapture = useMemo(() => {
    // Timeline scrub / auto-replay step takes priority — each step needs its own solution capture.
    // gameplaySolutionStepId is only the fallback when no step is explicitly selected.
    if (!isCreator && scenarioSequence.length > 0) {
      const scrubbed = selectedEventSequenceStepId?.trim();
      if (scrubbed) {
        return defaultTimelineStepIdForSolutionCapture(scrubbed);
      }
      if (gameplaySolutionStepId != null) {
        return defaultTimelineStepIdForSolutionCapture(gameplaySolutionStepId);
      }
    }
    return defaultTimelineStepIdForSolutionCapture(selectedEventSequenceStepId);
  }, [gameplaySolutionStepId, isCreator, scenarioSequence.length, selectedEventSequenceStepId]);
  const solutionUrl = useAppSelector((state) =>
    resolveEventSequenceSolutionUrl(
      state.solutionUrls as Record<string, string | undefined>,
      scenario.scenarioId,
      {
        usePerStepKeys: usePerStepSolutionKeys,
        stepId: solutionStepIdForCapture,
        allowLegacyFallback: !usePerStepSolutionKeys,
      },
    ),
  );
  const [modelToolbarDragStarted, setModelToolbarDragStarted] = useState(false);
  const [solutionCaptureBusy, setSolutionCaptureBusy] = useState(false);
  const solutionFrameRef = useRef<FrameHandle | null>(null);
  const captureNav = useOptionalDrawboardNavbarCapture();
  const { manualDrawboardCapture } = useGameRuntimeConfig();
  const runtimeKey = useMemo(
    () => getEventSequenceRuntimeKey(currentLevel, scenario.scenarioId, isCreator),
    [currentLevel, isCreator, scenario.scenarioId],
  );
  const sequenceRuntime = useSyncExternalStore(
    useCallback((listener) => subscribeSequenceRuntime(runtimeKey, listener), [runtimeKey]),
    useCallback(() => getSequenceRuntimeState(runtimeKey), [runtimeKey]),
    useCallback(() => getSequenceRuntimeState(runtimeKey), [runtimeKey]),
  );
  const fallbackEvents = useMemo(() => level?.events ?? [], [level]);
  const {
    selectedSequenceIndex,
    replaySequence,
    interactionTriggers,
    shouldShowInteractivePreview,
    frameNeedsInteractive,
    isSequenceRecording,
  } = useEventSequencePreview({
    isCreator,
    scenarioSequence,
    selectedEventSequenceStepId,
    eventSequenceScopedTriggers,
    recordingMode: sequenceRuntime.recordingMode,
    creatorPreviewInteractive,
    hasCapture: Boolean(solutionUrl),
    fallbackEvents,
  });
  const effectiveShowInteractivePreview = shouldShowInteractivePreview;
  const selectedEventSequenceStep = selectedSequenceIndex >= 0 ? scenarioSequence[selectedSequenceIndex] : null;
  const useLiveSolutionForStepScrub =
    isCreator && frameNeedsInteractive && scenarioSequence.length > 0;
  const interactiveSnapshotOverride = useMemo(() => {
    if (useLiveSolutionForStepScrub) {
      return null;
    }
    if (isCreator && shouldShowInteractivePreview && selectedEventSequenceStep) {
      return selectedEventSequenceStep.snapshot;
    }
    return null;
  }, [
    isCreator,
    selectedEventSequenceStep,
    shouldShowInteractivePreview,
    useLiveSolutionForStepScrub,
  ]);
  const bindSolutionFrame = useCallback(
    (instance: FrameHandle | null) => {
      solutionFrameRef.current = instance;
      if (registerForNavbarCapture) {
        captureNav?.registerSolutionFrame(instance);
      }
    },
    [registerForNavbarCapture, captureNav],
  );

  useEffect(() => {
    return () => {
      if (registerForNavbarCapture) {
        captureNav?.registerSolutionFrame(null);
      }
    };
  }, [registerForNavbarCapture, captureNav]);

  const handleSolutionCaptureBusy = useCallback(
    (busy: boolean) => {
      setSolutionCaptureBusy(busy);
      if (registerForNavbarCapture) {
        captureNav?.notifySolutionBusy(busy);
      }
    },
    [captureNav, registerForNavbarCapture],
  );
  const handleSwitchModel = useCallback(() => {
    dispatch(toggleShowModelSolution(currentLevel));
    syncLevelFields(currentLevel - 1, ["showModelPicture"]);
  }, [currentLevel, dispatch, syncLevelFields]);

  return (
    <div className="relative flex h-full min-h-0 w-full justify-center">
      <BoardContainer
        width={scenario.dimensions.width}
        height={scenario.dimensions.height}
        allowScaling={allowScaling}
      >
        <Board>
          <ModelArtContainer
            scenario={scenario}
            showInteractivePreview={effectiveShowInteractivePreview}
            frameRef={bindSolutionFrame}
            onCaptureBusyChange={handleSolutionCaptureBusy}
            isCreator={isCreator}
            scenarioSequenceLength={scenarioSequence.length}
            solutionUrl={solutionUrl}
            eventSequenceSolutionStepId={usePerStepSolutionKeys ? solutionStepIdForCapture : null}
            allowTransientSolutionIframe={!suppressHeavyLayoutEffects}
            interactiveOverride={frameNeedsInteractive}
            recordingSequence={isSequenceRecording}
            replaySequence={replaySequence}
            interactionTriggers={interactionTriggers}
            snapshotOverride={interactiveSnapshotOverride}
            suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
          >
            <div
              className="relative"
              style={{
                width: scenario.dimensions.width,
                height: scenario.dimensions.height,
                pointerEvents: effectiveShowInteractivePreview ? "none" : "auto",
              }}
            >
              {isCreator && !effectiveShowInteractivePreview && (
                <DraggableFloatingPanel
                  showOnHover
                  storageKey={`floating-button-model-${scenario.scenarioId}`}
                  defaultPosition={{ x: -16, y: 16 }}
                  onDragStateChange={setModelToolbarDragStarted}
                >
                  <div className="flex flex-row items-center gap-3 rounded-lg border border-border/60 bg-background/85 px-3 py-2 text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-background/95">
                    {manualDrawboardCapture && (
                      <>
                        <div className="h-8 w-px shrink-0 bg-border/60" aria-hidden />
                        <PoppingTitle topTitle="Capture picture from solution (static view)">
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-7 w-7"
                            disabled={solutionCaptureBusy}
                            aria-label="Capture picture from solution (static view)"
                            onClick={() => solutionFrameRef.current?.requestCapture()}
                          >
                            <Camera className="h-4 w-4" />
                          </Button>
                        </PoppingTitle>
                      </>
                    )}
                    <>
                      <div className="h-8 w-px shrink-0 bg-border/60" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <DiffModelToggleContent
                          dragStarted={modelToolbarDragStarted}
                          leftLabel="diff"
                          rightLabel="model"
                          checked={showModel}
                          onCheckedChange={handleSwitchModel}
                        />
                      </div>
                    </>
                  </div>
                </DraggableFloatingPanel>
              )}
              {!isCreator && !effectiveShowInteractivePreview && (
                <FloatingActionButton
                  showOnHover
                  storageKey={`floating-diff-model-game-${scenario.scenarioId}`}
                  leftLabel="diff"
                  rightLabel="model"
                  checked={showModel}
                  onCheckedChange={handleSwitchModel}
                />
              )}
              {!effectiveShowInteractivePreview && (
                <div className="relative z-[1]">
                  {showModel && (solutionUrl) ? (
                    <Image
                      name="solution"
                      imageUrl={solutionUrl}
                      alt="Reference solution"
                      height={scenario.dimensions.height}
                      width={scenario.dimensions.width}
                      loadingMessage="Loading reference image…"
                    />
                  ) : (
                    <Diff scenario={scenario} />
                  )}
                </div>
              )}
              {solutionCaptureBusy && (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center bg-background/55 backdrop-blur-[1px]"
                  aria-busy
                  aria-label="Generating picture"
                >
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                </div>
              )}
            </div>
          </ModelArtContainer>
        </Board>
        {/* <BoardTitle side="right">Model version</BoardTitle> */}
      </BoardContainer>
    </div>
  );
};
