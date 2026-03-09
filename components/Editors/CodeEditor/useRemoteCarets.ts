import { useEffect, useState, type MutableRefObject } from "react";
import type { EditorView } from "@codemirror/view";

import type { EditorCursor } from "@/lib/collaboration/types";

import type { RemoteEditorCaret } from "./types";
import { buildRemoteCarets } from "./collaborationUtils";
import { areRemoteCaretsEqual } from "./utils";

interface UseRemoteCaretsOptions {
  editorViewRef: MutableRefObject<EditorView | null>;
  editorViewportRef: MutableRefObject<HTMLDivElement | null>;
  editorCursors: Map<string, EditorCursor>;
  editorType: string;
  levelIndex: number;
  isConnected: boolean;
  code: string;
}

export function useRemoteCarets({
  editorViewRef,
  editorViewportRef,
  editorCursors,
  editorType,
  levelIndex,
  isConnected,
  code,
}: UseRemoteCaretsOptions) {
  const [remoteCarets, setRemoteCarets] = useState<RemoteEditorCaret[]>([]);

  useEffect(() => {
    if (!isConnected || !editorViewRef.current || !editorViewportRef.current) {
      if (remoteCarets.length > 0) {
        queueMicrotask(() => setRemoteCarets([]));
      }
      return;
    }

    let rafId: number | null = null;

    const recomputeCarets = () => {
      const view = editorViewRef.current;
      const viewport = editorViewportRef.current;
      if (!view || !viewport) {
        setRemoteCarets([]);
        return;
      }

      const nextCarets = buildRemoteCarets(view, viewport, editorCursors, editorType, levelIndex);
      setRemoteCarets((prev) => (areRemoteCaretsEqual(prev, nextCarets) ? prev : nextCarets));
    };

    const scheduleRecompute = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(recomputeCarets);
    };

    scheduleRecompute();

    const view = editorViewRef.current;
    const scrollDom = view?.scrollDOM;
    const win = typeof window !== "undefined" ? window : null;

    scrollDom?.addEventListener("scroll", scheduleRecompute, { passive: true });
    win?.addEventListener("resize", scheduleRecompute);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      scrollDom?.removeEventListener("scroll", scheduleRecompute);
      win?.removeEventListener("resize", scheduleRecompute);
    };
  }, [code, editorCursors, editorType, editorViewRef, editorViewportRef, isConnected, levelIndex, remoteCarets.length]);

  return {
    remoteCarets,
  };
}
