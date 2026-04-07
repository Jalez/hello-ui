'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { sendScoreToParentFrame } from "@/store/actions/score.actions";
import { ScenarioUpdater } from "./ScenarioUpdater";
import { updateDrawnState } from "@/store/slices/solutions.slice";
import { imageDataFromRawRgba } from "@/lib/utils/drawboardSnapshot";
import {
  clearDrawboardPixelsStore,
  clearStoredSolutionSide,
  notifyDrawboardPixels,
} from "@/lib/drawboard/drawboardPixelsStore";
import { subscribeLiveSolutionFrameRemoved } from "@/lib/drawboard/solutionFrameLifecycle";
import {
  getEventSequenceScenarioUiKey,
  getEventSequenceRuntimeKey,
  getEventSequenceUiState,
  getSequenceRuntimeState,
  subscribeEventSequenceUiState,
  INITIAL_EVENT_SEQUENCE_STEP_ID,
} from "@/lib/drawboard/eventSequenceState";
import {
  defaultTimelineStepIdForSolutionCapture,
  resolveEventSequenceSolutionUrl,
} from "@/lib/drawboard/eventSequenceSolutionUrls";

// drawingPixels, solutionPixels should be objects, where key is the scenarioId and value is the ImageData
type scenarioData = {
  [key: string]: ImageData;
};

export const scenarioDiffs = {};

export const LevelUpdater = () => {
  const [drawingPixels, setDrawingPixels] = useState<scenarioData>({});
  const [solutionPixels, setSolutionPixels] = useState<scenarioData>({});
  const drawingPixelSourceUrlsRef = useRef<Record<string, string>>({});
  const solutionPixelSourceUrlsRef = useRef<Record<string, string>>({});
  const points = useAppSelector((state) => state.points);
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const options = useAppSelector((state) => state.options);

  // get the level from the levels array
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string | undefined>);
  const solutionUrls = useAppSelector((state) => state.solutionUrls as Record<string, string | undefined>);
  const eventSequenceUiState = useSyncExternalStore(
    subscribeEventSequenceUiState,
    getEventSequenceUiState,
    getEventSequenceUiState,
  );

  useEffect(() => {
    let cancelled = false;

    const loadImageDataFromUrl = async (url: string, width: number, height: number): Promise<ImageData | null> => {
      const image = new window.Image();
      image.crossOrigin = "anonymous";
      image.src = url;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Failed to load image"));
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0, width, height);
      return ctx.getImageData(0, 0, width, height);
    };

    const hydratePixelsFromStoredUrls = async () => {
      if (!level?.scenarios?.length) {
        return;
      }
      for (const scenario of level.scenarios) {
        const width = scenario.dimensions.width;
        const height = scenario.dimensions.height;
        const drawingUrl = drawingUrls[scenario.scenarioId]?.trim();
        const scenarioSequence = level.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];
        const runtimeKey = getEventSequenceRuntimeKey(currentLevel, scenario.scenarioId, options.creator);
        const runtimeState = getSequenceRuntimeState(runtimeKey);
        const activeIndex =
          runtimeState.activeIndex >= scenarioSequence.length ? 0 : runtimeState.activeIndex;
        const uiScenarioKey = getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId);
        const selectedStepId =
          eventSequenceUiState.selectedStepIdByScenario[uiScenarioKey]?.trim() ?? null;
        const activeStepId =
          !options.creator && scenarioSequence.length > 0
            ? scenarioSequence[activeIndex]?.id ?? null
            : null;
        const solutionStepId =
          scenarioSequence.length > 0
            ? defaultTimelineStepIdForSolutionCapture(
                selectedStepId ?? activeStepId ?? INITIAL_EVENT_SEQUENCE_STEP_ID,
              )
            : defaultTimelineStepIdForSolutionCapture(selectedStepId);
        const solutionUrl = resolveEventSequenceSolutionUrl(solutionUrls, scenario.scenarioId, {
          usePerStepKeys: !options.creator && scenarioSequence.length > 0,
          stepId: solutionStepId,
          allowLegacyFallback: true,
        })?.trim();

        const previousDrawingUrl = drawingPixelSourceUrlsRef.current[scenario.scenarioId];
        if (drawingUrl && previousDrawingUrl !== drawingUrl) {
          try {
            const imageData = await loadImageDataFromUrl(drawingUrl, width, height);
            if (!cancelled && imageData) {
              drawingPixelSourceUrlsRef.current[scenario.scenarioId] = drawingUrl;
              setDrawingPixels((prev) => ({
                ...prev,
                [scenario.scenarioId]: imageData,
              }));
            }
          } catch {
            // Ignore hydration failures; live iframe pixels can still populate.
          }
        }

        const previousSolutionUrl = solutionPixelSourceUrlsRef.current[scenario.scenarioId];
        if (solutionUrl && previousSolutionUrl !== solutionUrl) {
          try {
            const imageData = await loadImageDataFromUrl(solutionUrl, width, height);
            if (!cancelled && imageData) {
              solutionPixelSourceUrlsRef.current[scenario.scenarioId] = solutionUrl;
              setSolutionPixels((prev) => ({
                ...prev,
                [scenario.scenarioId]: imageData,
              }));
            }
          } catch {
            // Ignore hydration failures; live iframe pixels can still populate.
          }
        }
      }
    };

    void hydratePixelsFromStoredUrls();
    return () => {
      cancelled = true;
    };
  }, [
    currentLevel,
    drawingUrls,
    eventSequenceUiState,
    level,
    options.creator,
    solutionUrls,
  ]);

  useEffect(() => {
    // reset the pixels when level changes
    queueMicrotask(() => {
      setDrawingPixels({});
      setSolutionPixels({});
      drawingPixelSourceUrlsRef.current = {};
      solutionPixelSourceUrlsRef.current = {};
      clearDrawboardPixelsStore();
    });

    const handlePixelsFromIframe = (event: MessageEvent) => {
      if (event.data.message !== "pixels") return;
      if (!(event.data.dataURL instanceof ArrayBuffer)) return;
      const imageData = imageDataFromRawRgba(
        event.data.dataURL,
        event.data.width,
        event.data.height
      );
      if (event.data.urlName === "solutionUrl") {
        solutionPixelSourceUrlsRef.current[event.data.scenarioId] = "__live_iframe__";
        setSolutionPixels((prev) => ({
          ...prev,
          [event.data.scenarioId]: imageData,
        }));
        notifyDrawboardPixels(
          event.data.scenarioId,
          "solution",
          imageData,
          typeof event.data.replaySignature === "string" ? event.data.replaySignature : null,
        );
        return;
      } else if (event.data.urlName === "drawingUrl") {
        drawingPixelSourceUrlsRef.current[event.data.scenarioId] = "__live_iframe__";
        setDrawingPixels((prev) => ({
          ...prev,
          [event.data.scenarioId]: imageData,
        }));
        notifyDrawboardPixels(
          event.data.scenarioId,
          "drawing",
          imageData,
          typeof event.data.replaySignature === "string" ? event.data.replaySignature : null,
        );
      }
    };

    window.addEventListener("message", handlePixelsFromIframe);
    return () => {
      window.removeEventListener("message", handlePixelsFromIframe);
    };
  }, [currentLevel]);

  useEffect(() => {
    dispatch(sendScoreToParentFrame());
  }, [points.allPoints, dispatch]);

  useEffect(() => {
    return subscribeLiveSolutionFrameRemoved((scenarioId) => {
      setSolutionPixels((prev) => {
        if (!(scenarioId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[scenarioId];
        return next;
      });
      delete solutionPixelSourceUrlsRef.current[scenarioId];
      clearStoredSolutionSide(scenarioId);
    });
  }, []);

  const solutions = useAppSelector((state) => state.solutions);

  useEffect(() => {
    const scenarioIds = Object.keys(solutionPixels);
    if (!level) return;
    const scenarios = Array.isArray(level.scenarios) ? level.scenarios : [];
    const hasAllPixels = scenarios.every((s) => scenarioIds.includes(s.scenarioId));
    if (!hasAllPixels) return;
    // Only dispatch if not already marked as drawn — prevents continuous cascade
    if (solutions[level.name]?.drawn) return;
    dispatch(
      updateDrawnState({
        levelId: level.name,
        drawn: true,
      })
    );
  }, [solutionPixels, level, solutions, dispatch]);

  if (!level) return null;
  const scenarios = Array.isArray(level.scenarios) ? level.scenarios : [];
  // get the points from the current level

  return (
    <>
      {scenarios.map((scenario) => {
        return (
          <ErrorBoundary key={scenario.scenarioId}>
            <ScenarioUpdater
              scenario={scenario}
              drawingPixels={drawingPixels[scenario.scenarioId] || undefined}
              solutionPixels={solutionPixels[scenario.scenarioId] || undefined}
              differenceStepId={
                (level.eventSequence?.byScenarioId?.[scenario.scenarioId]?.length ?? 0) > 0
                  ? (
                      eventSequenceUiState.selectedStepIdByScenario[
                        getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId)
                      ]?.trim() || INITIAL_EVENT_SEQUENCE_STEP_ID
                    )
                  : null
              }
            />
          </ErrorBoundary>
        );
      })}
    </>
  );
};

type ErrorBoundaryState = {
  hasError: boolean;
};

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children;
  }
}
