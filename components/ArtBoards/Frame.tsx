/** @format */
'use client';

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import { addDrawingUrl } from "@/store/slices/drawingUrls.slice";
import { cn } from "@/lib/utils/cn";
import { apiUrl } from "@/lib/apiUrl";
import { LOCAL_REDUX_UPDATE_DEBOUNCE_MS } from "@/components/Editors/CodeEditor/constants";
import { dataUrlFromRawRgba } from "@/lib/utils/drawboardSnapshot";

const DRAWBOARD_CAPTURE_MODE = process.env.NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE ?? "playwright";

interface FrameProps {
  newHtml: string;
  newCss: string;
  newJs: string;
  events: string[];
  id: string;
  name: string;
  frameUrl?: string;
  scenario: scenario;
  hiddenFromView?: boolean;
}

export const Frame = ({
  id,
  newHtml,
  newCss,
  newJs,
  name,
  events,
  scenario,
  frameUrl = process.env.NEXT_PUBLIC_DRAWBOARD_URL || "http://localhost:3500",
  hiddenFromView = false,
}: FrameProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const renderReadyCaptureTimeoutRef = useRef<number | null>(null);
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state: { currentLevel: { currentLevel: number } }) => state.currentLevel);
  const isCreator = useAppSelector((state) => state.options.creator);
  const counterRef = useRef({ reloads: 0, mounts: 0, data: 0, lastLog: Date.now() });

  const level = useAppSelector((state: { levels: Array<{ interactive: boolean }> }) => state.levels[currentLevel - 1]);
  const interactive = level.interactive;

  const captureFrame = useCallback(
    async (
      snapshot: { css: string; snapshotHtml: string },
      includeDataUrl = name === "solutionUrl" || (name === "drawingUrl" && isCreator),
    ) => {
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

        const payload = await response.json() as {
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
      }
    },
    [dispatch, isCreator, name, scenario.dimensions.height, scenario.dimensions.width, scenario.scenarioId],
  );

  const clearPendingRenderReadyCapture = useCallback(() => {
    if (renderReadyCaptureTimeoutRef.current) {
      window.clearTimeout(renderReadyCaptureTimeoutRef.current);
      renderReadyCaptureTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const resendDataAfterMount = (event: MessageEvent) => {
      if (event.data === "mounted") {
        counterRef.current.mounts++;
        const now = Date.now();
        if (now - counterRef.current.lastLog > 5000) {
          console.log(`[Frame:${name}] 5s stats: reloads=${counterRef.current.reloads} mounts=${counterRef.current.mounts} data=${counterRef.current.data}`);
          counterRef.current = { reloads: 0, mounts: 0, data: 0, lastLog: now };
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
          },
          "*"
        );
        return;
      }

      if (
        event.data?.name === name
        && event.data?.scenarioId === scenario.scenarioId
        && (event.data?.message === "render-ready" || event.data?.message === "capture-request")
        && typeof event.data?.css === "string"
        && typeof event.data?.snapshotHtml === "string"
      ) {
        if (DRAWBOARD_CAPTURE_MODE === "browser") {
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
        }, LOCAL_REDUX_UPDATE_DEBOUNCE_MS);
      }
    };

    window.addEventListener("message", resendDataAfterMount);

    return () => {
      clearPendingRenderReadyCapture();
      window.removeEventListener("message", resendDataAfterMount);
    };
  }, [captureFrame, clearPendingRenderReadyCapture, dispatch, events, interactive, isCreator, name, newCss, newHtml, newJs, scenario]);

  useEffect(() => {
    const handleDisplayUrlFromIframe = (event: MessageEvent) => {
      if (event.data?.message !== "data" || typeof event.data?.dataURL !== "string") {
        return;
      }
      if (event.data.urlName !== name || event.data.scenarioId !== scenario.scenarioId) {
        return;
      }
      const includeDataUrl = name === "solutionUrl" || (name === "drawingUrl" && isCreator);
      if (!includeDataUrl) {
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
    };

    window.addEventListener("message", handleDisplayUrlFromIframe);
    return () => {
      window.removeEventListener("message", handleDisplayUrlFromIframe);
    };
  }, [dispatch, isCreator, name, scenario.scenarioId]);

  useEffect(() => {
    const iframe = iframeRef.current;
    counterRef.current.reloads++;
    clearPendingRenderReadyCapture();
    if (iframe) {
      iframeRef.current?.contentWindow?.postMessage(
        {
          message: "reload",
          name,
        },
        "*"
      );
    }
  }, [clearPendingRenderReadyCapture, newHtml, newCss, iframeRef, newJs, name, interactive]);
  if (!scenario) {
    return <div>Scenario not found</div>;
  }

  const iframeSearch = new URLSearchParams({
    name,
    scenarioId: scenario.scenarioId,
    width: String(scenario.dimensions.width),
    height: String(scenario.dimensions.height),
    captureMode: DRAWBOARD_CAPTURE_MODE,
  });

  return (
    <iframe
      id={id}
      ref={iframeRef}
      src={`${frameUrl}?${iframeSearch.toString()}`}
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
      className={cn(
        "overflow-hidden m-0 p-0 border-none bg-secondary absolute top-0 left-0 z-0 transition-[z-index] duration-300 ease-in-out",
        hiddenFromView && "pointer-events-none opacity-0"
      )}
      aria-hidden={hiddenFromView}
      style={{
        width: `${scenario.dimensions.width}px`,
        height: `${scenario.dimensions.height}px`,
        visibility: hiddenFromView ? "hidden" : "visible",
      }}
    />
  );
};
