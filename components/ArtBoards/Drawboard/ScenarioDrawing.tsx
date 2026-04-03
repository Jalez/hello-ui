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
import { updateLevelAccuracyByIndexThunk } from "@/store/actions/score.actions";
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
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  resetSequenceRuntimeState,
  setCreatorPreviewInteractiveForScenario,
  subscribeSequenceRuntime,
  updateSequenceRuntimeState,
} from "@/lib/drawboard/eventSequenceState";
import { aggregateEventSequenceAccuracy } from "@/lib/drawboard/aggregateEventSequenceAccuracy";
import {
  getDrawboardPixelsPair,
  subscribeDrawboardPixelsForScenario,
} from "@/lib/drawboard/drawboardPixelsStore";
import {
  defaultTimelineStepIdForSolutionCapture,
  resolveEventSequenceSolutionUrl,
} from "@/lib/drawboard/eventSequenceSolutionUrls";
import { useEventSequencePreview } from "@/lib/drawboard/useEventSequencePreview";

/** One bootstrap per level across all mounted clones (SidebySideArt mounts several instances). */
let playwrightGameInteractiveBootstrappedLevel: number | null = null;

/**
 * /api/drawboard/render returns a retina PNG in dataUrl but the logical-size RGBA buffer
 * in pixelBufferBase64 (same downscale as server-side scoring). Comparing via dataUrl
 * re-downscales in the browser and can disagree with iframe pixel diff + step truth.
 */
type DrawboardRenderPreviewPayload = {
  dataUrl: string;
  pixelBufferBase64: string;
  width: number;
  height: number;
};

function parseDrawboardRenderPreview(json: unknown): DrawboardRenderPreviewPayload | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const o = json as Record<string, unknown>;
  const pixelBufferBase64 = typeof o.pixelBufferBase64 === "string" ? o.pixelBufferBase64 : "";
  const dataUrl = typeof o.dataUrl === "string" ? o.dataUrl : "";
  const width = typeof o.width === "number" ? o.width : 0;
  const height = typeof o.height === "number" ? o.height : 0;
  if (!pixelBufferBase64 || width < 1 || height < 1) {
    return null;
  }
  return { pixelBufferBase64, dataUrl, width, height };
}

function imageDataFromScoringRgba(
  base64: string,
  width: number,
  height: number,
): ImageData | null {
  try {
    const binary = atob(base64);
    const expected = width * height * 4;
    if (binary.length !== expected) {
      return null;
    }
    const bytes = new Uint8Array(expected);
    for (let i = 0; i < expected; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new ImageData(new Uint8ClampedArray(bytes.buffer), width, height);
  } catch {
    return null;
  }
}

type LegacySolution = {
  SCSS: string;
  SHTML: string;
  SJS: string;
  drawn: boolean;
};

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
  const solutionUrls = useAppSelector((state) => state.solutionUrls as Record<string, string | undefined>);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string>);
  const drawingUrl = drawingUrls[scenario.scenarioId];
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();
  const options = useAppSelector((state) => state.options);
  const isCreator = creatorMode ?? options.creator;
  const [drawingCaptureBusy, setDrawingCaptureBusy] = useState(false);
  const [stepPreviews, setStepPreviews] = useState<Record<string, DrawboardRenderPreviewPayload>>({});
  const stepPreviewsRef = useRef<Record<string, DrawboardRenderPreviewPayload>>({});
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
  const solutions = useAppSelector((state) => state.solutions as unknown as Record<string, LegacySolution>);
  const resolvedSolution = useMemo(() => {
    if (!level) {
      return { css: "", html: "" };
    }
    const defaultLevelSolutions = solutions[level.name]
      ? {
          css: solutions[level.name].SCSS,
          html: solutions[level.name].SHTML,
        }
      : null;
    const levelSolution = level.solution || { css: "", html: "", js: "" };
    return {
      css: levelSolution.css || defaultLevelSolutions?.css || "",
      html: levelSolution.html || defaultLevelSolutions?.html || "",
    };
  }, [level, solutions]);
  const resolvedSolutionCss = resolvedSolution.css;
  const resolvedSolutionHtml = resolvedSolution.html;
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
  const usePerStepSolutionKeys = !isCreator && scenarioSequence.length > 0;
  const drawingTimelineStepId = defaultTimelineStepIdForSolutionCapture(selectedEventSequenceStepId);
  const solutionUrl = useMemo(
    () =>
      resolveEventSequenceSolutionUrl(solutionUrls, scenario.scenarioId, {
        usePerStepKeys: usePerStepSolutionKeys,
        stepId: drawingTimelineStepId,
      }),
    [drawingTimelineStepId, scenario.scenarioId, solutionUrls, usePerStepSolutionKeys],
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
    stepPreviewsRef.current = stepPreviews;
  }, [stepPreviews]);

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

  /** Track solution CSS+HTML used for the last render batch (incl. baseline “initial” preview). */
  const lastRenderedSolutionSourceRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;

    const renderPreviews = async () => {
      if (suppressSequenceMetrics) {
        return;
      }
      if (!scenarioSequence.length) {
        setStepPreviews({});
        return;
      }
      if (drawboardCaptureMode === "browser") {
        setStepPreviews({});
        lastRenderedSolutionSourceRef.current = "";
        return;
      }

      const renderSourceKey = `${resolvedSolutionCss}\0${resolvedSolutionHtml}`;
      const sourceChanged = lastRenderedSolutionSourceRef.current !== renderSourceKey;
      const missingSteps = sourceChanged
        ? scenarioSequence
        : scenarioSequence.filter((step) => !stepPreviewsRef.current[step.id]);
      const needInitialPreview =
        sourceChanged || !stepPreviewsRef.current[INITIAL_EVENT_SEQUENCE_STEP_ID];

      const pruneStale = (current: Record<string, DrawboardRenderPreviewPayload>) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) => {
            if (id === INITIAL_EVENT_SEQUENCE_STEP_ID) {
              return true;
            }
            return scenarioSequence.some((step) => step.id === id);
          }),
        );

      if (missingSteps.length === 0 && !needInitialPreview) {
        setStepPreviews((current) => pruneStale(current));
        return;
      }

      lastRenderedSolutionSourceRef.current = renderSourceKey;

      const first = scenarioSequence[0];
      const renderBody = (snapshotHtml: string, width: number, height: number) =>
        fetch(apiUrl("/api/drawboard/render"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            css: resolvedSolutionCss,
            snapshotHtml,
            width,
            height,
            scenarioId: scenario.scenarioId,
            urlName: "solutionUrl",
            includeDataUrl: true,
          }),
        });

      const requests: Promise<readonly [string, DrawboardRenderPreviewPayload | null]>[] = [];

      if (needInitialPreview) {
        requests.push(
          (async (): Promise<readonly [string, DrawboardRenderPreviewPayload | null]> => {
            const response = await renderBody(
              resolvedSolutionHtml,
              first.snapshot.width,
              first.snapshot.height,
            );
            if (!response.ok) {
              return [INITIAL_EVENT_SEQUENCE_STEP_ID, null] as const;
            }
            const payload = parseDrawboardRenderPreview(await response.json());
            return [INITIAL_EVENT_SEQUENCE_STEP_ID, payload] as const;
          })(),
        );
      }

      missingSteps.forEach((step) => {
        requests.push(
          (async (): Promise<readonly [string, DrawboardRenderPreviewPayload | null]> => {
            const response = await renderBody(
              step.snapshot.snapshotHtml,
              step.snapshot.width,
              step.snapshot.height,
            );
            if (!response.ok) {
              return [step.id, null] as const;
            }
            const payload = parseDrawboardRenderPreview(await response.json());
            return [step.id, payload] as const;
          })(),
        );
      });

      const nextEntries = await Promise.all(requests);

      if (cancelled) {
        return;
      }

      setStepPreviews((current) => {
        const next = sourceChanged ? {} : { ...current };
        nextEntries.forEach(([id, entry]) => {
          if (entry) {
            next[id] = entry;
          }
        });
        return pruneStale(next);
      });
    };

    void renderPreviews();

    return () => {
      cancelled = true;
    };
  }, [
    drawboardCaptureMode,
    scenarioSequence,
    resolvedSolutionCss,
    resolvedSolutionHtml,
    scenario.scenarioId,
    suppressSequenceMetrics,
  ]);

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

    /**
     * Compare the drawing only to the timeline-focused step (selectedEventSequenceStepId).
     * In game mode, also compare the active gameplay step when it is pending verification
     * and the player is scrubbed to a different step, so advancement still sees a fresh score.
     */
    const compareFocusedStepsToDrawing = async (): Promise<Record<string, number> | null> => {
      if (!drawingUrl || !scenarioSequence.length) {
        return null;
      }

      const ids = new Set<string>();
      const focus = selectedEventSequenceStepId?.trim();
      if (focus) {
        ids.add(focus);
      }

      const pendingId = getSequenceRuntimeState(runtimeKey).pendingStepId;
      if (
        !isCreator
        && gameplayActiveSequenceStep
        && pendingId === gameplayActiveSequenceStep.id
        && !ids.has(gameplayActiveSequenceStep.id)
      ) {
        ids.add(gameplayActiveSequenceStep.id);
      }

      if (ids.size === 0) {
        return null;
      }

      if (drawboardCaptureMode === "browser") {
        const { drawing, solution } = getDrawboardPixelsPair(scenario.scenarioId);
        if (
          drawing
          && solution
          && drawing.width === solution.width
          && drawing.height === solution.height
        ) {
          const comparison = await runWorkerCompare(drawing, solution);
          if (cancelled) {
            return null;
          }
          const nextAccuracies: Record<string, number> = {};
          [...ids].forEach((id) => {
            nextAccuracies[id] = comparison;
          });
          return nextAccuracies;
        }
        const w = scenario.dimensions.width;
        const h = scenario.dimensions.height;
        if (solutionUrl?.trim() && w > 0 && h > 0) {
          try {
            const targetData = await loadImageDataForSnapshot(solutionUrl, w, h);
            const drawingData = await loadImageDataForSnapshot(drawingUrl, w, h);
            if (
              targetData
              && drawingData
              && !cancelled
              && targetData.width === drawingData.width
              && targetData.height === drawingData.height
            ) {
              const comparison = await runWorkerCompare(drawingData, targetData);
              if (cancelled) {
                return null;
              }
              const nextAccuracies: Record<string, number> = {};
              [...ids].forEach((id) => {
                nextAccuracies[id] = comparison;
              });
              return nextAccuracies;
            }
          } catch {
            /* fall through to server-render path */
          }
        }
      }

      const compareOne = async (stepId: string): Promise<readonly [string, number | null]> => {
        if (stepId === INITIAL_EVENT_SEQUENCE_STEP_ID) {
          const targetPreview = stepPreviews[INITIAL_EVENT_SEQUENCE_STEP_ID];
          if (!targetPreview) {
            return [stepId, null] as const;
          }
          const targetData = imageDataFromScoringRgba(
            targetPreview.pixelBufferBase64,
            targetPreview.width,
            targetPreview.height,
          );
          const drawingData = await loadImageDataForSnapshot(
            drawingUrl,
            targetPreview.width,
            targetPreview.height,
          );
          if (!drawingData || !targetData || cancelled) {
            return [stepId, null] as const;
          }
          const comparison = await runWorkerCompare(drawingData, targetData);
          return [stepId, comparison] as const;
        }

        const step = scenarioSequence.find((s) => s.id === stepId);
        if (!step) {
          return [stepId, null] as const;
        }
        const targetPreview = stepPreviews[step.id];
        if (!targetPreview) {
          return [stepId, null] as const;
        }
        const targetData = imageDataFromScoringRgba(
          targetPreview.pixelBufferBase64,
          targetPreview.width,
          targetPreview.height,
        );
        const drawingData = await loadImageDataForSnapshot(
          drawingUrl,
          targetPreview.width,
          targetPreview.height,
        );
        if (!drawingData || !targetData || cancelled) {
          return [stepId, null] as const;
        }
        const comparison = await runWorkerCompare(drawingData, targetData);
        return [stepId, comparison] as const;
      };

      const results = await Promise.all([...ids].map((id) => compareOne(id)));
      if (cancelled) {
        return null;
      }
      const nextAccuracies: Record<string, number> = {};
      results.forEach(([id, value]) => {
        if (value !== null) {
          nextAccuracies[id] = value;
        }
      });
      return Object.keys(nextAccuracies).length > 0 ? nextAccuracies : null;
    };

    const pushFooterAccuracyForSequence = (mergedStepAccuracies: Record<string, number>) => {
      if (!scenarioSequence.length) {
        return;
      }
      const agg = aggregateEventSequenceAccuracy(scenarioSequence, mergedStepAccuracies);
      if (agg === null) {
        return;
      }
      dispatch(updateLevelAccuracyByIndexThunk(currentLevel - 1, scenario.scenarioId, agg));
    };

    const runCreatorComparisons = async () => {
      const nextAccuracies = await compareFocusedStepsToDrawing();
      if (!nextAccuracies || cancelled) {
        return;
      }
      let mergedSnapshot: Record<string, number> = {};
      updateSequenceRuntimeState(runtimeKey, (current) => {
        mergedSnapshot = { ...current.stepAccuracies, ...nextAccuracies };
        return {
          ...current,
          stepAccuracies: mergedSnapshot,
        };
      });
      pushFooterAccuracyForSequence(mergedSnapshot);
    };

    const runGameComparisons = async () => {
      if (!scenarioSequence.length) {
        return;
      }
      const nextAccuracies = await compareFocusedStepsToDrawing();
      if (!nextAccuracies || cancelled) {
        return;
      }
      let mergedSnapshot: Record<string, number> = {};
      updateSequenceRuntimeState(runtimeKey, (current) => {
        mergedSnapshot = { ...current.stepAccuracies, ...nextAccuracies };
        const step = gameplayActiveSequenceStep;
        if (step && current.pendingStepId === step.id) {
          const comparison = nextAccuracies[step.id] ?? 0;
          if (comparison >= 99.5) {
            return {
              ...current,
              stepAccuracies: mergedSnapshot,
              pendingStepId: null,
              activeIndex: Math.min(current.activeIndex + 1, scenarioSequence.length),
            };
          }
        }
        return {
          ...current,
          stepAccuracies: mergedSnapshot,
        };
      });
      pushFooterAccuracyForSequence(mergedSnapshot);
    };

    const runComparisons = () => {
      if (isCreator) {
        void runCreatorComparisons().catch((error) => {
          console.error("EventSequence: failed to compare steps (creator)", error);
        });
      } else {
        void runGameComparisons().catch((error) => {
          console.error("EventSequence: failed to compare steps (game)", error);
        });
      }
    };

    runComparisons();

    const unsubIframePixels =
      drawboardCaptureMode === "browser"
        ? subscribeDrawboardPixelsForScenario(scenario.scenarioId, () => {
            if (!cancelled) {
              runComparisons();
            }
          })
        : null;

    return () => {
      cancelled = true;
      unsubIframePixels?.();
    };
  }, [
    currentLevel,
    dispatch,
    drawboardCaptureMode,
    drawingUrl,
    gameplayActiveSequenceStep,
    isCreator,
    runtimeKey,
    scenario.dimensions.height,
    scenario.dimensions.width,
    scenario.scenarioId,
    scenarioSequence,
    selectedEventSequenceStepId,
    sequenceRuntime.pendingStepId,
    solutionUrl,
    stepPreviews,
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
