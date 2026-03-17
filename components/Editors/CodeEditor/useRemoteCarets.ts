import { useEffect, useState, type MutableRefObject } from "react";
import type { EditorView } from "@codemirror/view";

import { logCollaborationStep } from "@/lib/collaboration/logCollaborationStep";
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

/**
 * COLLABORATION STEP 15.9:
 * This hook converts shared presence data into visible remote carets on screen.
 * Said simply, it takes "where other people say they are editing" and redraws
 * that information in the current editor viewport.
 */
export function useRemoteCarets({
  editorViewRef,
  editorViewportRef,
  editorCursors,
  editorType,
  levelIndex,
  isConnected,
  code,
}: UseRemoteCaretsOptions) {
  logCollaborationStep("15.9", "useRemoteCarets", {
    editorType,
    levelIndex,
    isConnected,
    codeLength: code.length,
  });
  const [remoteCarets, setRemoteCarets] = useState<RemoteEditorCaret[]>([]);

  useEffect(() => {
    if (!isConnected || !editorViewRef.current || !editorViewportRef.current) {
      if (remoteCarets.length > 0) {
        queueMicrotask(() => setRemoteCarets([]));
      }
      return;
    }

    let rafId: number | null = null;

    /**
     * COLLABORATION STEP 15.10:
     * Rebuild the remote caret overlay from the latest awareness data and the
     * current scroll position so collaborator cursors stay visually accurate.
     */
    const recomputeCarets = () => {
      logCollaborationStep("15.10", "recomputeCarets", {
        editorType,
        levelIndex,
        remoteCursorCount: editorCursors.size,
      });
      const view = editorViewRef.current;
      const viewport = editorViewportRef.current;
      if (!view || !viewport) {
        setRemoteCarets([]);
        return;
      }

      const nextCarets = buildRemoteCarets(view, viewport, editorCursors, editorType, levelIndex);
      setRemoteCarets((prev) => (areRemoteCaretsEqual(prev, nextCarets) ? prev : nextCarets));
    };

    /**
     * COLLABORATION STEP 15.11:
     * Batch caret recalculation onto the next animation frame so the UI updates
     * smoothly even when collaboration presence changes rapidly.
     */
    const scheduleRecompute = () => {
      logCollaborationStep("15.11", "scheduleRecompute", {
        editorType,
        levelIndex,
      });
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
