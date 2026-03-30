/** @format */
"use client";

import type { FrameHandle } from "@/components/ArtBoards/Frame";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type DrawboardNavbarCaptureContextValue = {
  registerSolutionFrame: (handle: FrameHandle | null) => void;
  registerDrawingFrame: (handle: FrameHandle | null) => void;
  notifySolutionBusy: (busy: boolean) => void;
  notifyDrawingBusy: (busy: boolean) => void;
  requestCaptureBoth: () => void;
  captureBusy: boolean;
};

const DrawboardNavbarCaptureContext = createContext<DrawboardNavbarCaptureContextValue | null>(null);

export function DrawboardNavbarCaptureProvider({ children }: { children: ReactNode }): React.ReactNode {
  const solutionRef = useRef<FrameHandle | null>(null);
  const drawingRef = useRef<FrameHandle | null>(null);
  const [solutionBusy, setSolutionBusy] = useState(false);
  const [drawingBusy, setDrawingBusy] = useState(false);

  const registerSolutionFrame = useCallback((handle: FrameHandle | null) => {
    solutionRef.current = handle;
  }, []);

  const registerDrawingFrame = useCallback((handle: FrameHandle | null) => {
    drawingRef.current = handle;
  }, []);

  const notifySolutionBusy = useCallback((busy: boolean) => {
    setSolutionBusy(busy);
  }, []);

  const notifyDrawingBusy = useCallback((busy: boolean) => {
    setDrawingBusy(busy);
  }, []);

  const requestCaptureBoth = useCallback(() => {
    solutionRef.current?.requestCapture();
    drawingRef.current?.requestCapture();
  }, []);

  const value = useMemo(
    () => ({
      registerSolutionFrame,
      registerDrawingFrame,
      notifySolutionBusy,
      notifyDrawingBusy,
      requestCaptureBoth,
      captureBusy: solutionBusy || drawingBusy,
    }),
    [
      registerSolutionFrame,
      registerDrawingFrame,
      notifySolutionBusy,
      notifyDrawingBusy,
      requestCaptureBoth,
      solutionBusy,
      drawingBusy,
    ],
  );

  return (
    <DrawboardNavbarCaptureContext.Provider value={value}>{children}</DrawboardNavbarCaptureContext.Provider>
  );
}

export function useOptionalDrawboardNavbarCapture(): DrawboardNavbarCaptureContextValue | null {
  return useContext(DrawboardNavbarCaptureContext);
}
