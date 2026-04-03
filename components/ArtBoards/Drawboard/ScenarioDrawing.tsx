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
import { scenario, VerifiedInteraction } from "@/types";
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
import { stepToInteractionTrigger } from "@/lib/drawboard/interactionEvents";
import { apiUrl } from "@/lib/apiUrl";
import {
  getEventSequenceRuntimeKey,
  getSequenceRuntimeState,
  resetSequenceRuntimeState,
  setCreatorPreviewInteractiveForScenario,
  subscribeSequenceRuntime,
  updateSequenceRuntimeState,
} from "@/lib/drawboard/eventSequenceState";

/** One bootstrap per level across all mounted clones (SidebySideArt mounts several instances). */
let playwrightGameInteractiveBootstrappedLevel: number | null = null;

type ScenarioDrawingProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  creatorPreviewInteractive?: boolean;
  creatorMode?: boolean;
  selectedEventSequenceStepId?: string | null;
};

export const ScenarioDrawing = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  creatorPreviewInteractive,
  creatorMode,
  selectedEventSequenceStepId,
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
  const shouldShowInteractivePreview = isCreator && (creatorPreviewInteractive ?? !drawingUrl);
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
  const normalizedActiveSequenceIndex = sequenceRuntime.activeIndex >= scenarioSequence.length ? 0 : sequenceRuntime.activeIndex;
  const activeSequenceStep = scenarioSequence[normalizedActiveSequenceIndex] ?? null;
  const isSequenceRecording = sequenceRuntime.recordingMode !== "idle" && shouldShowInteractivePreview;
  const selectedSequenceIndex = selectedEventSequenceStepId
    ? scenarioSequence.findIndex((step) => step.id === selectedEventSequenceStepId)
    : -1;
  const replaySequence = isCreator && shouldShowInteractivePreview && selectedSequenceIndex >= 0
    ? scenarioSequence.slice(0, selectedSequenceIndex + 1)
    : [];
  const frameEvents = useMemo(() => {
    if (scenarioSequence.length > 0) {
      if (isCreator) {
        return isSequenceRecording ? [] : scenarioSequence.map((step) => stepToInteractionTrigger(step));
      }
      return interactive && activeSequenceStep ? [stepToInteractionTrigger(activeSequenceStep)] : [];
    }

    return level?.events || [];
  }, [activeSequenceStep, interactive, isCreator, isSequenceRecording, level?.events, scenarioSequence]);

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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      resetSequenceRuntimeState(runtimeKey);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [runtimeKey]);

  useEffect(() => {
    stepPreviewUrlsRef.current = stepPreviewUrls;
  }, [stepPreviewUrls]);

  useEffect(() => {
    if (!isCreator) {
      return;
    }
    setCreatorPreviewInteractiveForScenario(currentLevel, scenario.scenarioId, shouldShowInteractivePreview);
  }, [currentLevel, isCreator, scenario.scenarioId, shouldShowInteractivePreview]);

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

  useEffect(() => {
    let cancelled = false;

    const renderPreviews = async () => {
      if (!scenarioSequence.length) {
      setStepPreviewUrls({});
      return;
      }

      const missingSteps = scenarioSequence.filter((step) => !stepPreviewUrlsRef.current[step.id]);
      if (missingSteps.length === 0) {
        setStepPreviewUrls((current) => Object.fromEntries(
          Object.entries(current).filter(([id]) => scenarioSequence.some((step) => step.id === id)),
        ));
        return;
      }

      const nextEntries = await Promise.all(missingSteps.map(async (step) => {
        
        const response = await fetch(apiUrl("/api/drawboard/render"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            css: step.snapshot.css,
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
        const next = { ...current };
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
  }, [scenarioSequence]);

  useEffect(() => {
    if (isCreator || !interactive || !activeSequenceStep || !drawingUrl || !stepPreviewUrls[activeSequenceStep.id]) {
      return;
    }

    let cancelled = false;
    const targetUrl = stepPreviewUrls[activeSequenceStep.id];

    const compareCurrentStep = async () => {
      const loadImageData = async (url: string) => {
        const image = new window.Image();
        image.crossOrigin = "anonymous";
        image.src = url;
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error(`Failed to load image: ${url.slice(0, 32)}`));
        });
        const canvas = document.createElement("canvas");
        canvas.width = activeSequenceStep.snapshot.width;
        canvas.height = activeSequenceStep.snapshot.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return null;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      };

      const [drawingData, targetData] = await Promise.all([
        loadImageData(drawingUrl),
        loadImageData(targetUrl),
      ]);
      if (!drawingData || !targetData || cancelled) {
        return;
      }

      const worker = new Worker(
        new URL('../../../lib/utils/workers/imageComparisonWorker.ts', import.meta.url),
        { type: 'module' },
      );

      const comparison = await new Promise<number>((resolve, reject) => {
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
      }).finally(() => {
        worker.terminate();
      });

      if (cancelled) {
        return;
      }

      updateSequenceRuntimeState(runtimeKey, (current) => {
        const nextAccuracies = { ...current.stepAccuracies, [activeSequenceStep.id]: comparison };
        if (current.pendingStepId === activeSequenceStep.id && comparison >= 99.5) {
          nextAccuracies[activeSequenceStep.id] = 100;
          return {
            ...current,
            stepAccuracies: nextAccuracies,
            pendingStepId: null,
            activeIndex: Math.min(current.activeIndex + 1, scenarioSequence.length),
          };
        }
        return {
          ...current,
          stepAccuracies: nextAccuracies,
        };
      });
    };

    void compareCurrentStep().catch((error) => {
      console.error("EventSequence: failed to compare current step", error);
    });

    return () => {
      cancelled = true;
    };
  }, [activeSequenceStep, drawingUrl, interactive, isCreator, runtimeKey, scenarioSequence.length, stepPreviewUrls]);

  const handleVerifiedInteraction = useCallback((interaction: VerifiedInteraction) => {
    if (isCreator || !activeSequenceStep) {
      return;
    }
    if (interaction.triggerId !== activeSequenceStep.id) {
      return;
    }
    updateSequenceRuntimeState(runtimeKey, (current) => ({
      ...current,
      pendingStepId: activeSequenceStep.id,
    }));
  }, [activeSequenceStep, isCreator, runtimeKey]);

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
                          interactiveOverride={shouldShowInteractivePreview}
                          recordingSequence={isSequenceRecording}
                          replaySequence={replaySequence}
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
                          hiddenFromView={!interactive}
                          onCaptureBusyChange={handleDrawingCaptureBusy}
                          onVerifiedInteraction={handleVerifiedInteraction}
                        />
                        {!interactive && (
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
