'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Image } from "@/components/General/Image/Image";
import { ArtContainer } from "../ArtContainer";
import { Frame } from "../Frame";
import "./Drawboard.css";
import { SlideShower } from "./ImageContainer/SlideShower";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { Button } from "@/components/ui/button";
import { scenario, VerifiedInteraction, type EventSequenceStep } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { toggleImageInteractivity } from "@/store/slices/levels.slice";
import { Camera, Loader2 } from "lucide-react";
import type { FrameHandle } from "@/components/ArtBoards/Frame";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { ScenarioDimensionsWrapper } from "./ScenarioDimensionsWrapper";
import { ScenarioHoverContainer } from "./ScenarioHoverContainer";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { apiUrl } from "@/lib/apiUrl";
import {
  getEventSequenceRuntimeKey,
  getSequenceRuntimeState,
  resetSequenceRuntimeState,
  setCreatorPreviewInteractiveForScenario,
  subscribeSequenceRuntime,
  updateSequenceRuntimeState,
} from "@/lib/drawboard/eventSequenceState";
import { useEventSequencePreview } from "@/lib/drawboard/useEventSequencePreview";

/** One bootstrap per level across all mounted clones (SidebySideArt mounts several instances). */
let playwrightGameInteractiveBootstrappedLevel: number | null = null;

type ScenarioDrawingProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  suppressHeavyLayoutEffects?: boolean;
  creatorPreviewInteractive?: boolean;
  creatorMode?: boolean;
  selectedEventSequenceStepId?: string | null;
  /**
   * When true (ArtBoards with an event sequence), interaction triggers match the replay depth only.
   * When false (e.g. DrawBoard), all sequence triggers stay registered.
   */
  eventSequenceScopedTriggers?: boolean;
};

export const ScenarioDrawing = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
  creatorPreviewInteractive,
  creatorMode,
  selectedEventSequenceStepId,
  eventSequenceScopedTriggers = false,
}: ScenarioDrawingProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutionUrls = useAppSelector((state) => state.solutionUrls as Record<string, string>);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string>);
  const solutionUrl = solutionUrls[scenario.scenarioId];
  const drawingUrl = drawingUrls[scenario.scenarioId];
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();
  const options = useAppSelector((state) => state.options);
  const isCreator = creatorMode ?? options.creator;
  const [drawingCaptureBusy, setDrawingCaptureBusy] = useState(false);
  const [stepPreviewUrls, setStepPreviewUrls] = useState<Record<string, string>>({});
  const stepPreviewUrlsRef = useRef<Record<string, string>>({});
  const drawingFrameRef = useRef<FrameHandle | null>(null);
  const captureNav = useOptionalDrawboardNavbarCapture();
  const { drawboardCaptureMode, manualDrawboardCapture } = useGameRuntimeConfig();

  const bindDrawingFrame = useCallback(
    (instance: FrameHandle | null) => {
      drawingFrameRef.current = instance;
      if (registerForNavbarCapture) {
        captureNav?.registerDrawingFrame(instance);
      }
    },
    [registerForNavbarCapture, captureNav],
  );

  useEffect(() => {
    return () => {
      if (registerForNavbarCapture) {
        captureNav?.registerDrawingFrame(null);
      }
    };
  }, [registerForNavbarCapture, captureNav]);

  const handleDrawingCaptureBusy = useCallback(
    (busy: boolean) => {
      setDrawingCaptureBusy(busy);
      if (registerForNavbarCapture) {
        captureNav?.notifyDrawingBusy(busy);
      }
    },
    [captureNav, registerForNavbarCapture],
  );
  const css = level?.code.css ?? "";
  const html = level?.code.html ?? "";
  const js = level?.code.js ?? "";
  const solutionCss = level?.solution?.css ?? "";
  const interactive = level?.interactive ?? false;
  const runtimeKey = useMemo(
    () => getEventSequenceRuntimeKey(currentLevel, scenario.scenarioId, isCreator),
    [currentLevel, isCreator, scenario.scenarioId],
  );
  const sequenceRuntime = useSyncExternalStore(
    useCallback((listener) => subscribeSequenceRuntime(runtimeKey, listener), [runtimeKey]),
    useCallback(() => getSequenceRuntimeState(runtimeKey), [runtimeKey]),
    useCallback(() => getSequenceRuntimeState(runtimeKey), [runtimeKey]),
  );
  const scenarioSequence = useMemo(
    () => level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [],
    [level?.eventSequence, scenario.scenarioId],
  );
  /**
   * Solution preview fetch + step accuracy compare: skip probes and hidden carousel clones
   * (suppressHeavyLayoutEffects). When an event sequence exists, only the primary board
   * (registerForNavbarCapture) runs metrics so we do not duplicate work or race updates.
   */
  const allowSequenceMetrics =
    scenarioSequence.length > 0
      ? registerForNavbarCapture && !suppressHeavyLayoutEffects
      : !suppressHeavyLayoutEffects;
  const suppressSequenceMetrics = !allowSequenceMetrics;
  const normalizedActiveSequenceIndex = sequenceRuntime.activeIndex >= scenarioSequence.length ? 0 : sequenceRuntime.activeIndex;
  /** Gameplay progression (not timeline scrub) — used for grading advance + verified interactions. */
  const gameplayActiveSequenceStep = scenarioSequence[normalizedActiveSequenceIndex] ?? null;
  const fallbackEvents = useMemo(() => level?.events || [], [level?.events]);
  const {
    selectedSequenceIndex,
    replaySequence,
    interactionTriggers: frameEvents,
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
    hasCapture: Boolean(drawingUrl),
    fallbackEvents,
  });

  useEffect(() => {
    if (!level) {
      return;
    }
    if (isCreator) {
      return;
    }
    if (drawboardCaptureMode !== "playwright") {
      return;
    }
    if (playwrightGameInteractiveBootstrappedLevel === currentLevel) {
      return;
    }
    if (!level.interactive) {
      dispatch(toggleImageInteractivity(currentLevel));
      syncLevelFields(currentLevel - 1, ["interactive"]);
    }
    playwrightGameInteractiveBootstrappedLevel = currentLevel;
  }, [currentLevel, dispatch, drawboardCaptureMode, isCreator, level, syncLevelFields]);

  const previousRuntimeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = previousRuntimeKeyRef.current;
    previousRuntimeKeyRef.current = runtimeKey;
    // Only reset when switching level/scenario — not on remount (e.g. SidebySideArt layout branch swap),
    // or we clear recordingMode immediately after the user starts continuous recording.
    if (prev !== null && prev !== runtimeKey) {
      resetSequenceRuntimeState(prev);
    }
  }, [runtimeKey]);

  useEffect(() => {
    stepPreviewUrlsRef.current = stepPreviewUrls;
  }, [stepPreviewUrls]);

  useEffect(() => {
    if (!isCreator) {
      return;
    }
    setCreatorPreviewInteractiveForScenario(
      currentLevel,
      scenario.scenarioId,
      Boolean(creatorPreviewInteractive ?? !drawingUrl),
    );
  }, [creatorPreviewInteractive, currentLevel, drawingUrl, isCreator, scenario.scenarioId]);

  const previousSequenceLengthRef = useRef(scenarioSequence.length);

  useEffect(() => {
    if (
      isCreator
      && previousSequenceLengthRef.current < scenarioSequence.length
      && sequenceRuntime.recordingMode === "single"
    ) {
      updateSequenceRuntimeState(runtimeKey, (current) => ({
        ...current,
        recordingMode: "idle",
      }));
    }
    previousSequenceLengthRef.current = scenarioSequence.length;
  }, [isCreator, runtimeKey, scenarioSequence.length, sequenceRuntime.recordingMode]);

  /** Track CSS used for the last render batch so we re-render when solution CSS changes. */
  const lastRenderedSolutionCssRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;

    const renderPreviews = async () => {
      if (suppressSequenceMetrics) {
        return;
      }
      if (!scenarioSequence.length) {
        setStepPreviewUrls({});
        return;
      }

      const cssChanged = lastRenderedSolutionCssRef.current !== solutionCss;
      const missingSteps = cssChanged
        ? scenarioSequence
        : scenarioSequence.filter((step) => !stepPreviewUrlsRef.current[step.id]);
      if (missingSteps.length === 0) {
        setStepPreviewUrls((current) => Object.fromEntries(
          Object.entries(current).filter(([id]) => scenarioSequence.some((step) => step.id === id)),
        ));
        return;
      }

      lastRenderedSolutionCssRef.current = solutionCss;

      const nextEntries = await Promise.all(missingSteps.map(async (step) => {
        const response = await fetch(apiUrl("/api/drawboard/render"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            css: solutionCss,
            snapshotHtml: step.snapshot.snapshotHtml,
            width: step.snapshot.width,
            height: step.snapshot.height,
            scenarioId: step.scenarioId,
            urlName: "solutionUrl",
            includeDataUrl: true,
          }),
        });

        if (!response.ok) {
          return [step.id, ""] as const;
        }

        const payload = await response.json() as { dataUrl?: string };
        return [step.id, payload.dataUrl || ""] as const;
      }));

      if (cancelled) {
        return;
      }

      setStepPreviewUrls((current) => {
        const next = cssChanged ? {} : { ...current };
        nextEntries.forEach(([id, url]) => {
          if (url) {
            next[id] = url;
          }
        });
        Object.keys(next).forEach((id) => {
          if (!scenarioSequence.some((step) => step.id === id)) {
            delete next[id];
          }
        });
        return next;
      });
    };

    void renderPreviews();

    return () => {
      cancelled = true;
    };
  }, [scenarioSequence, solutionCss, suppressSequenceMetrics]);

  useEffect(() => {
    if (suppressSequenceMetrics) {
      return;
    }

    let cancelled = false;

    const loadImageDataForSnapshot = async (url: string, width: number, height: number) => {
      const image = new window.Image();
      image.crossOrigin = "anonymous";
      image.src = url;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Failed to load image: ${url.slice(0, 32)}`));
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    };

    const runWorkerCompare = async (
      drawingData: ImageData,
      targetData: ImageData,
    ): Promise<number> => {
      const worker = new Worker(
        new URL("../../../lib/utils/workers/imageComparisonWorker.ts", import.meta.url),
        { type: "module" },
      );
      try {
        return await new Promise<number>((resolve, reject) => {
          worker.onmessage = ({ data }) => resolve(data.accuracy as number);
          worker.onerror = reject;
          const drawingBuffer = drawingData.data.buffer.slice(0);
          const targetBuffer = targetData.data.buffer.slice(0);
          worker.postMessage(
            {
              drawingBuffer,
              solutionBuffer: targetBuffer,
              width: drawingData.width,
              height: drawingData.height,
            },
            [drawingBuffer, targetBuffer],
          );
        });
      } finally {
        worker.terminate();
      }
    };

    const compareAllStepsToDrawing = async (): Promise<Record<string, number> | null> => {
      if (!drawingUrl || !scenarioSequence.length) {
        return null;
      }
      const missingPreview = scenarioSequence.some((step) => !stepPreviewUrls[step.id]);
      if (missingPreview) {
        return null;
      }
      const comparisons = await Promise.all(
        scenarioSequence.map(async (step) => {
          const targetUrl = stepPreviewUrls[step.id];
          const [drawingData, targetData] = await Promise.all([
            loadImageDataForSnapshot(drawingUrl, step.snapshot.width, step.snapshot.height),
            loadImageDataForSnapshot(targetUrl, step.snapshot.width, step.snapshot.height),
          ]);
          if (!drawingData || !targetData || cancelled) {
            return [step.id, null] as const;
          }
          const comparison = await runWorkerCompare(drawingData, targetData);
          return [step.id, comparison] as const;
        }),
      );
      if (cancelled) {
        return null;
      }
      const nextAccuracies: Record<string, number> = {};
      comparisons.forEach(([id, value]) => {
        if (value !== null) {
          nextAccuracies[id] = value;
        }
      });
      return nextAccuracies;
    };

    const runCreatorComparisons = async () => {
      const nextAccuracies = await compareAllStepsToDrawing();
      if (!nextAccuracies || cancelled) {
        return;
      }
      updateSequenceRuntimeState(runtimeKey, (current) => ({
        ...current,
        stepAccuracies: { ...current.stepAccuracies, ...nextAccuracies },
      }));
    };

    const runGameComparisons = async () => {
      if (!scenarioSequence.length) {
        return;
      }
      const nextAccuracies = await compareAllStepsToDrawing();
      if (!nextAccuracies || cancelled) {
        return;
      }
      updateSequenceRuntimeState(runtimeKey, (current) => {
        const merged = { ...current.stepAccuracies, ...nextAccuracies };
        const step = gameplayActiveSequenceStep;
        if (step && current.pendingStepId === step.id) {
          const comparison = nextAccuracies[step.id] ?? 0;
          if (comparison >= 99.5) {
            return {
              ...current,
              stepAccuracies: { ...merged, [step.id]: 100 },
              pendingStepId: null,
              activeIndex: Math.min(current.activeIndex + 1, scenarioSequence.length),
            };
          }
        }
        return {
          ...current,
          stepAccuracies: merged,
        };
      });
    };

    if (isCreator) {
      void runCreatorComparisons().catch((error) => {
        console.error("EventSequence: failed to compare steps (creator)", error);
      });
    } else {
      void runGameComparisons().catch((error) => {
        console.error("EventSequence: failed to compare steps (game)", error);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [
    drawingUrl,
    gameplayActiveSequenceStep,
    isCreator,
    runtimeKey,
    scenarioSequence,
    stepPreviewUrls,
    suppressSequenceMetrics,
  ]);

  const handleVerifiedInteraction = useCallback((interaction: VerifiedInteraction) => {
    if (isCreator || !gameplayActiveSequenceStep) {
      return;
    }
    if (interaction.triggerId !== gameplayActiveSequenceStep.id) {
      return;
    }
    updateSequenceRuntimeState(runtimeKey, (current) => ({
      ...current,
      pendingStepId: gameplayActiveSequenceStep.id,
    }));
  }, [gameplayActiveSequenceStep, isCreator, runtimeKey]);

  if (!level) return null;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center">
      <BoardContainer
        width={scenario.dimensions.width}
        height={scenario.dimensions.height}
        allowScaling={allowScaling}
      >
        {/* <BoardTitle>Your version</BoardTitle> */}
        <Board>
          {" "}
          <ArtContainer>
            <div className="relative">
              {isCreator && (
                <ScenarioHoverContainer enabled={!shouldShowInteractivePreview}>
                  <div className="relative h-full w-full min-h-[1px]">
                    <ScenarioDimensionsWrapper
                      scenario={scenario}
                      levelId={currentLevel}
                      showDimensions={true}
                      setShowDimensions={() => {}}
                    />
                  </div>
                </ScenarioHoverContainer>
              )}
              {!isCreator && (
                <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
                  {manualDrawboardCapture && interactive && (
                    <PoppingTitle topTitle="Capture picture from your preview">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-background/90 shadow-sm"
                        disabled={drawingCaptureBusy}
                        aria-label="Capture picture from your preview"
                        onClick={() => drawingFrameRef.current?.requestCapture()}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </PoppingTitle>
                  )}
                </div>
              )}
              <SlideShower
                sliderHeight={scenario.dimensions.height}
                showStatic={!interactive && !isCreator}
                staticComponent={
                  <Image
                    imageUrl={solutionUrl}
                    alt="Reference image"
                    height={scenario.dimensions.height}
                    width={scenario.dimensions.width}
                    loadingMessage="Loading reference image…"
                  />
                }
                slidingComponent={
                  <div
                    className="overflow-hidden relative"
                    style={{
                      height: `${scenario.dimensions.height}px`,
                      width: `${scenario.dimensions.width}px`,
                    }}
                  >
                    {isCreator ? (
                      <>
                        <Frame
                          ref={bindDrawingFrame}
                          id="DrawBoard"
                          events={frameEvents}
                          newCss={css}
                          newHtml={html}
                          newJs={js + "\n" + scenario.js}
                          scenario={scenario}
                          name="drawingUrl"
                          hiddenFromView={!shouldShowInteractivePreview}
                          onCaptureBusyChange={handleDrawingCaptureBusy}
                          interactiveOverride={frameNeedsInteractive}
                          recordingSequence={isSequenceRecording}
                          persistRecordedSequenceStep={isSequenceRecording}
                          replaySequence={replaySequence}
                          suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
                          dataTestId={suppressHeavyLayoutEffects ? undefined : "creator-template-drawboard-frame"}
                          onVerifiedInteraction={handleVerifiedInteraction}
                        />
                        {!shouldShowInteractivePreview && (
                          <div className="relative z-[1]">
                            <Image
                              name="drawing"
                              imageUrl={drawingUrl}
                              alt="Creator static preview"
                              height={scenario.dimensions.height}
                              width={scenario.dimensions.width}
                              loadingMessage="Loading your design…"
                            />
                          </div>
                        )}
                        {manualDrawboardCapture && !shouldShowInteractivePreview && (
                          <div className="absolute top-2 right-2 z-30">
                            <PoppingTitle topTitle="Capture picture from your design">
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7 bg-background/90 shadow-sm"
                                disabled={drawingCaptureBusy}
                                aria-label="Capture picture from your design"
                                onClick={() => drawingFrameRef.current?.requestCapture()}
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            </PoppingTitle>
                          </div>
                        )}
                        {manualDrawboardCapture && shouldShowInteractivePreview && (
                          <div className="absolute top-2 right-2 z-30">
                            <PoppingTitle topTitle="Capture picture from your preview">
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7 bg-background/90 shadow-sm"
                                disabled={drawingCaptureBusy}
                                aria-label="Capture picture from your preview"
                                onClick={() => drawingFrameRef.current?.requestCapture()}
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            </PoppingTitle>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <Frame
                          ref={bindDrawingFrame}
                          id="DrawBoard"
                          events={frameEvents}
                          newCss={css}
                          newHtml={html}
                          newJs={js + "\n" + scenario.js}
                          scenario={scenario}
                          name="drawingUrl"
                          hiddenFromView={!interactive && !frameNeedsInteractive}
                          onCaptureBusyChange={handleDrawingCaptureBusy}
                          interactiveOverride={frameNeedsInteractive}
                          recordingSequence={isSequenceRecording}
                          persistRecordedSequenceStep={isSequenceRecording}
                          replaySequence={replaySequence}
                          suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
                          onVerifiedInteraction={handleVerifiedInteraction}
                        />
                        {!interactive && !frameNeedsInteractive && (
                          <div className="relative z-[1]">
                            <Image
                              name="drawing"
                              imageUrl={drawingUrl}
                              alt="Player static preview"
                              height={scenario.dimensions.height}
                              width={scenario.dimensions.width}
                              loadingMessage="Loading your design…"
                            />
                          </div>
                        )}
                      </>
                    )}
                    {drawingCaptureBusy
                      && (!isCreator || shouldShowInteractivePreview) && (
                      <div
                        className="absolute inset-0 z-20 flex items-center justify-center bg-background/55 backdrop-blur-[1px]"
                        aria-busy
                        aria-label="Generating picture"
                      >
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                }
              />
            </div>
          </ArtContainer>
        </Board>
      </BoardContainer>
    </div>
  );
};
