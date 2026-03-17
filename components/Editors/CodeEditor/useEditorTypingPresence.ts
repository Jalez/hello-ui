import { useCallback, useEffect, useRef } from "react";

import { logCollaborationStep } from "@/lib/collaboration/logCollaborationStep";
import type { EditorType } from "@/lib/collaboration/types";

interface UseEditorTypingPresenceOptions {
  isConnected: boolean;
  locked: boolean;
  setTyping?: (editorType: EditorType, levelIndex: number, isTyping: boolean) => void;
  editorType: EditorType;
  levelIndex: number;
  title: "HTML" | "CSS" | "JS";
}

/**
 * COLLABORATION STEP 5.4:
 * This hook turns bursts of local typing into "user is typing" presence signals.
 * In plain language, it flips the remote typing indicator on when the user starts
 * editing and turns it back off after they go quiet or the editor unmounts.
 */
export function useEditorTypingPresence({
  isConnected,
  locked,
  setTyping,
  editorType,
  levelIndex,
  title,
}: UseEditorTypingPresenceOptions) {
  logCollaborationStep("5.4", "useEditorTypingPresence", {
    editorType,
    levelIndex,
    title,
    isConnected,
    locked,
  });
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const handleTypingEndRef = useRef<() => void>(() => {});

  /**
   * COLLABORATION STEP 5.5:
   * Mark this editor session as actively typing so other collaborators can see
   * that this person is currently working in this file and level.
   */
  const handleTypingStart = useCallback(() => {
    logCollaborationStep("5.5", "handleTypingStart", {
      editorType,
      levelIndex,
      isConnected,
      locked,
    });
    if (isTypingRef.current) {
      return;
    }

    if (isConnected && !locked && setTyping) {
      isTypingRef.current = true;
      setTyping(editorType, levelIndex, true);
    }
  }, [editorType, isConnected, levelIndex, locked, setTyping]);

  /**
   * COLLABORATION STEP 5.6:
   * Clear the typing flag once the local burst of input has stopped so presence
   * does not get stuck saying someone is still editing when they already paused.
   */
  const handleTypingEnd = useCallback(() => {
    logCollaborationStep("5.6", "handleTypingEnd", {
      editorType,
      levelIndex,
      isConnected,
    });
    if (!isTypingRef.current) {
      return;
    }

    isTypingRef.current = false;
    if (isConnected && setTyping) {
      setTyping(editorType, levelIndex, false);
    }
  }, [editorType, isConnected, levelIndex, setTyping]);

  useEffect(() => {
    handleTypingEndRef.current = handleTypingEnd;
  }, [handleTypingEnd]);

  useEffect(() => {
    const typingTimeout = typingTimeoutRef;
    return () => {
      handleTypingEndRef.current();
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    };
  }, [editorType, levelIndex, title]);

  return {
    typingTimeoutRef,
    handleTypingStart,
    handleTypingEnd,
  };
}
