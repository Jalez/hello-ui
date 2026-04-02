/** @format */
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { EventSequenceStep, InteractionTrigger, VerifiedInteraction, scenario } from "@/types";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import { addDrawingUrl } from "@/store/slices/drawingUrls.slice";
import { appendEventSequenceStep, recordVerifiedInteraction } from "@/store/slices/levels.slice";
import { cn } from "@/lib/utils/cn";
import { apiUrl } from "@/lib/apiUrl";
import { dataUrlFromRawRgba } from "@/lib/utils/drawboardSnapshot";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";

/**
 * Module-level capture dedup. SidebySideArt renders each content element multiple times
 * (probes + layout modes), creating several Frame instances for the same name+scenarioId.
 * The event.source guard handles per-message isolation, but all instances still process
 * their own iframe independently. This content-aware dedup ensures only one API call per
 * unique snapshot, collapsing duplicates from the redundant instances.
 */
const _lastCapture = new Map<string, { time: number; contentKey: string }>();
const _lastVerifiedInteraction = new Map<string, number>();
const CAPTURE_DEDUP_MS = 100;
/** Below Playwright layout follow-up interval so a second identical snapshot can refresh captures after fonts settle. */
const CAPTURE_SAME_CONTENT_WINDOW_MS = 320;

function shouldCapture(key: string, contentKey: string): boolean {
  const now = Date.now();
  const last = _lastCapture.get(key);
  if (last) {
    if (last.contentKey === contentKey && now - last.time < CAPTURE_SAME_CONTENT_WINDOW_MS) return false;
    if (now - last.time < CAPTURE_DEDUP_MS) return false;
  }
  _lastCapture.set(key, { time: now, contentKey });
  return true;
}

function shouldStoreVerifiedInteraction(key: string): boolean {
  const now = Date.now();
  const last = _lastVerifiedInteraction.get(key);
  if (last && now - last < 250) return false;
  _lastVerifiedInteraction.set(key, now);
  return true;
}

export type FrameHandle = {
  requestCapture: () => void;
};

interface FrameProps {
  newHtml: string;
  newCss: string;
  newJs: string;
  events: InteractionTrigger[];
  id: string;
  name: string;
  frameUrl?: string;
  scenario: scenario;
  hiddenFromView?: boolean;
  onCaptureBusyChange?: (busy: boolean) => void;
  recordingSequence?: boolean;
  onVerifiedInteraction?: (interaction: VerifiedInteraction) => void;
}

export const Frame = forwardRef<FrameHandle, FrameProps>(function Frame(
  {
    id,
    newHtml,
    newCss,
    newJs,
    name,
    events,
    scenario,
    frameUrl = process.env.NEXT_PUBLIC_DRAWBOARD_URL || "http://localhost:3500",
    hiddenFromView = false,
    onCaptureBusyChange,
    recordingSequence = false,
    onVerifiedInteraction,
  },
  ref,
) {
  const { drawboardCaptureMode, manualDrawboardCapture, remoteSyncDebounceMs, drawboardReloadDebounceMs } = useGameRuntimeConfig();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const renderReadyCaptureTimeoutRef = useRef<number | null>(null);
  const iframeReloadDebounceRef = useRef<number | null>(null);
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();
  const { currentLevel } = useAppSelector((state: { currentLevel: { currentLevel: number } }) => state.currentLevel);
  const isCreator = useAppSelector((state) => state.options.creator);
  const level = useAppSelector((state: { levels: Array<{ interactive: boolean }> }) => state.levels[currentLevel - 1]);
  const existingImageUrl = useAppSelector((state) => {
    if (name === "solutionUrl") {
      return (state.solutionUrls as Record<string, string | undefined>)[scenario.scenarioId];
    }
    if (name === "drawingUrl") {
      return (state.drawingUrls as Record<string, string | undefined>)[scenario.scenarioId];
    }
    return undefined;
  });
  const interactive = level.interactive;

  const notifyCaptureBusy = useCallback(
    (busy: boolean) => {
      onCaptureBusyChange?.(busy);
    },
    [onCaptureBusyChange],
  );

  const captureFrame = useCallback(
    async (
      snapshot: { css: string; snapshotHtml: string },
      /** Always ask for HiDPI PNG so solution vs drawing static images use the same asset (browser scales identically). Game mode used to omit this for drawingUrl only, which made the two boards look different despite identical Playwright input. */
      includeDataUrl = true,
    ) => {
      const dedupKey = `${name}:${scenario.scenarioId}`;
      const contentKey = `${snapshot.snapshotHtml.length}:${snapshot.css.length}:${snapshot.snapshotHtml.slice(0, 64)}`;
      if (!shouldCapture(dedupKey, contentKey)) return;
      notifyCaptureBusy(true);
      try {
        const response = await fetch(apiUrl("/api/drawboard/render"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            css: snapshot.css,
            snapshotHtml: snapshot.snapshotHtml,
            width: scenario.dimensions.width,
            height: scenario.dimensions.height,
            scenarioId: scenario.scenarioId,
            urlName: name,
            includeDataUrl,
          }),
        });

        if (!response.ok) {
          throw new Error(`Drawboard render failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          scenarioId: string;
          urlName: string;
          width: number;
          height: number;
          pixelBufferBase64: string;
          dataUrl?: string;
        };

        const binary = atob(payload.pixelBufferBase64);
        const pixelBuffer = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          pixelBuffer[index] = binary.charCodeAt(index);
        }

        const displayDataUrl =
          payload.dataUrl || dataUrlFromRawRgba(pixelBuffer, payload.width, payload.height);

        window.postMessage(
          {
            message: "pixels",
            dataURL: pixelBuffer.buffer,
            urlName: payload.urlName,
            scenarioId: payload.scenarioId,
            width: payload.width,
            height: payload.height,
          },
          "*",
          [pixelBuffer.buffer],
        );

        if (payload.urlName === "solutionUrl") {
          dispatch(
            addSolutionUrl({
              solutionUrl: displayDataUrl,
              scenarioId: payload.scenarioId,
            }),
          );
        }

        if (payload.urlName === "drawingUrl") {
          dispatch(
            addDrawingUrl({
              drawingUrl: displayDataUrl,
              scenarioId: payload.scenarioId,
            }),
          );
        }
      } catch (error) {
        console.error(`[Frame:${name}] Failed to capture frame`, error);
      } finally {
        notifyCaptureBusy(false);
      }
    },
    [dispatch, name, notifyCaptureBusy, scenario.dimensions.height, scenario.dimensions.width, scenario.scenarioId],
  );

  useImperativeHandle(
    ref,
    () => ({
      requestCapture: () => {
        const win = iframeRef.current?.contentWindow;
        if (!win) {
          return;
        }
        if (drawboardCaptureMode === "browser") {
          notifyCaptureBusy(true);
        }
        win.postMessage(
          {
            message: "request-capture",
            name,
            scenarioId: scenario.scenarioId,
          },
          "*",
        );
      },
    }),
    [drawboardCaptureMode, name, notifyCaptureBusy, scenario.scenarioId],
  );

  const clearPendingRenderReadyCapture = useCallback(() => {
    if (renderReadyCaptureTimeoutRef.current) {
      window.clearTimeout(renderReadyCaptureTimeoutRef.current);
      renderReadyCaptureTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const resendDataAfterMount = (event: MessageEvent) => {
      const mountedPayload =
        typeof event.data === "object" && event.data !== null ? event.data : null;
      const isStructuredMounted =
        mountedPayload?.message === "mounted"
        && typeof mountedPayload.name === "string"
        && typeof mountedPayload.scenarioId === "string";
      const isLegacyMountedString = event.data === "mounted";

      if (isStructuredMounted || isLegacyMountedString) {
        const childWin = iframeRef.current?.contentWindow;
        if (!childWin || event.source !== childWin) {
          return;
        }
        iframeRef.current?.contentWindow?.postMessage(
          {
            html: newHtml,
            css: newCss,
            js: newJs,
            events: JSON.stringify(events),
            scenarioId: scenario.scenarioId,
            name,
            interactive,
            isCreator,
            recordingSequence,
          },
          "*",
        );
        return;
      }

      if (
        event.source === iframeRef.current?.contentWindow
        && event.data?.name === name
        && event.data?.scenarioId === scenario.scenarioId
        && (event.data?.message === "render-ready" || event.data?.message === "capture-request")
        && typeof event.data?.css === "string"
        && typeof event.data?.snapshotHtml === "string"
      ) {
        if (drawboardCaptureMode === "browser") {
          return;
        }

        // Manual mode still needs the first render-ready snapshot to bootstrap the static board image.
        // After a scenario already has a stored image URL, later updates stay behind the manual button.
        if (manualDrawboardCapture && event.data.message === "render-ready" && existingImageUrl) {
          return;
        }

        const snapshot = {
          css: event.data.css,
          snapshotHtml: event.data.snapshotHtml,
        };

        if (event.data.message === "capture-request") {
          clearPendingRenderReadyCapture();
          void captureFrame(snapshot);
          return;
        }

        clearPendingRenderReadyCapture();
        renderReadyCaptureTimeoutRef.current = window.setTimeout(() => {
          renderReadyCaptureTimeoutRef.current = null;
          void captureFrame(snapshot);
        }, remoteSyncDebounceMs);
      }
    };

    window.addEventListener("message", resendDataAfterMount);

    return () => {
      clearPendingRenderReadyCapture();
      window.removeEventListener("message", resendDataAfterMount);
    };
  }, [
    captureFrame,
    clearPendingRenderReadyCapture,
    events,
    interactive,
    isCreator,
    drawboardCaptureMode,
    existingImageUrl,
    manualDrawboardCapture,
    name,
    newCss,
    newHtml,
    newJs,
    recordingSequence,
    remoteSyncDebounceMs,
    scenario.scenarioId,
  ]);

  useEffect(() => {
    const handleVerifiedInteraction = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.message !== "verified-interaction") {
        return;
      }
      if (event.data?.urlName !== name || event.data?.scenarioId !== scenario.scenarioId) {
        return;
      }
      if (!isCreator || name !== "drawingUrl") {
        return;
      }

      const interaction = event.data?.interaction as VerifiedInteraction | undefined;
      if (!interaction?.id) {
        return;
      }

      const dedupKey = `${scenario.scenarioId}:${interaction.id}`;
      if (!shouldStoreVerifiedInteraction(dedupKey)) {
        return;
      }

      onVerifiedInteraction?.(interaction);

      dispatch(
        recordVerifiedInteraction({
          levelId: currentLevel,
          scenarioId: scenario.scenarioId,
          interaction,
        }),
      );
      syncLevelFields(currentLevel - 1, ["interactionArtifacts"]);
    };

    window.addEventListener("message", handleVerifiedInteraction);
    return () => {
      window.removeEventListener("message", handleVerifiedInteraction);
    };
  }, [currentLevel, dispatch, isCreator, name, onVerifiedInteraction, scenario.scenarioId, syncLevelFields]);

  useEffect(() => {
    const handleRecordedSequenceStep = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      if (event.data?.message !== "recorded-event-sequence-step") {
        return;
      }
      if (event.data?.urlName !== name || event.data?.scenarioId !== scenario.scenarioId) {
        return;
      }
      if (!isCreator || name !== "drawingUrl") {
        return;
      }

      const step = event.data?.step as EventSequenceStep | undefined;
      if (!step?.id) {
        return;
      }

      dispatch(
        appendEventSequenceStep({
          levelId: currentLevel,
          scenarioId: scenario.scenarioId,
          step,
        }),
      );
      syncLevelFields(currentLevel - 1, ["eventSequence"]);
    };

    window.addEventListener("message", handleRecordedSequenceStep);
    return () => {
      window.removeEventListener("message", handleRecordedSequenceStep);
    };
  }, [currentLevel, dispatch, isCreator, name, scenario.scenarioId, syncLevelFields]);

  useEffect(() => {
    const handleDisplayUrlFromIframe = (event: MessageEvent) => {
      if (event.data?.message !== "data" || typeof event.data?.dataURL !== "string") {
        return;
      }
      if (event.data.urlName !== name || event.data.scenarioId !== scenario.scenarioId) {
        return;
      }
      if (name !== "solutionUrl" && name !== "drawingUrl") {
        return;
      }
      if (name === "solutionUrl") {
        dispatch(
          addSolutionUrl({
            solutionUrl: event.data.dataURL,
            scenarioId: scenario.scenarioId,
          }),
        );
      }
      if (name === "drawingUrl") {
        dispatch(
          addDrawingUrl({
            drawingUrl: event.data.dataURL,
            scenarioId: scenario.scenarioId,
          }),
        );
      }
      if (drawboardCaptureMode === "browser") {
        notifyCaptureBusy(false);
      }
    };

    window.addEventListener("message", handleDisplayUrlFromIframe);
    return () => {
      window.removeEventListener("message", handleDisplayUrlFromIframe);
    };
  }, [dispatch, drawboardCaptureMode, name, notifyCaptureBusy, scenario.scenarioId]);

  useEffect(() => {
    if (drawboardCaptureMode !== "browser") {
      return;
    }
    const onPixels = (event: MessageEvent) => {
      if (event.data?.message !== "pixels") {
        return;
      }
      if (event.data.urlName !== name || event.data.scenarioId !== scenario.scenarioId) {
        return;
      }
      notifyCaptureBusy(false);
    };
    window.addEventListener("message", onPixels);
    return () => {
      window.removeEventListener("message", onPixels);
    };
  }, [drawboardCaptureMode, name, notifyCaptureBusy, scenario.scenarioId]);

  /** When only interactive/creator flags change, patch the iframe instead of full reload (reload was syncing captures on static toggle by accident). */
  const optionsPatchKeyRef = useRef<string | null>(null);
  const optionsPatchScenarioIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!scenario) {
      return;
    }
    if (optionsPatchScenarioIdRef.current !== scenario.scenarioId) {
      optionsPatchScenarioIdRef.current = scenario.scenarioId;
      optionsPatchKeyRef.current = null;
    }
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      return;
    }
    const key = `${interactive}:${isCreator}:${recordingSequence}:${JSON.stringify(events)}`;
    if (optionsPatchKeyRef.current === null) {
      optionsPatchKeyRef.current = key;
      return;
    }
    if (optionsPatchKeyRef.current === key) {
      return;
    }
    optionsPatchKeyRef.current = key;
    win.postMessage(
      {
        message: "options-patch",
        name,
        scenarioId: scenario.scenarioId,
        interactive,
        isCreator,
        recordingSequence,
        events: JSON.stringify(events),
      },
      "*",
    );
  }, [scenario, scenario.scenarioId, interactive, isCreator, name, recordingSequence, events]);

  useEffect(() => {
    if (iframeReloadDebounceRef.current) {
      window.clearTimeout(iframeReloadDebounceRef.current);
      iframeReloadDebounceRef.current = null;
    }
    iframeReloadDebounceRef.current = window.setTimeout(() => {
      iframeReloadDebounceRef.current = null;
      const iframe = iframeRef.current;
      clearPendingRenderReadyCapture();
      if (iframe) {
        iframeRef.current?.contentWindow?.postMessage(
          {
            message: "reload",
            name,
          },
          "*",
        );
      }
    }, drawboardReloadDebounceMs);
    return () => {
      if (iframeReloadDebounceRef.current) {
        window.clearTimeout(iframeReloadDebounceRef.current);
        iframeReloadDebounceRef.current = null;
      }
    };
  }, [clearPendingRenderReadyCapture, drawboardReloadDebounceMs, newHtml, newCss, iframeRef, newJs, name]);

  if (!scenario) {
    return <div>Scenario not found</div>;
  }

  const iframeSearch = new URLSearchParams({
    name,
    scenarioId: scenario.scenarioId,
    width: String(scenario.dimensions.width),
    height: String(scenario.dimensions.height),
    captureMode: drawboardCaptureMode,
  });
  if (manualDrawboardCapture) {
    iframeSearch.set("manualCapture", "1");
  }

  return (
    <iframe
      id={id}
      ref={iframeRef}
      src={`${frameUrl}?${iframeSearch.toString()}`}
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
      className={cn(
        "overflow-hidden m-0 p-0 border-none bg-secondary absolute top-0 left-0 z-0 transition-[opacity] duration-300 ease-in-out",
        hiddenFromView && "pointer-events-none",
        // Always hide visually when covered by a static <img>; otherwise Playwright leaves the
        // iframe fully opaque and the live solution/drawing can leak through gaps or spinners.
        hiddenFromView && "opacity-0",
      )}
      aria-hidden={hiddenFromView}
      style={{
        width: `${scenario.dimensions.width}px`,
        height: `${scenario.dimensions.height}px`,
        visibility: "visible",
      }}
    />
  );
});

Frame.displayName = "Frame";
