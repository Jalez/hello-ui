import { useCallback, useEffect, useRef } from "react";

import type { EditorType } from "@/lib/collaboration/types";

interface UseEditorTypingPresenceOptions {
  isConnected: boolean;
  locked: boolean;
  setTyping?: (editorType: EditorType, levelIndex: number, isTyping: boolean) => void;
  editorType: EditorType;
  levelIndex: number;
  title: "HTML" | "CSS" | "JS";
}

export function useEditorTypingPresence({
  isConnected,
  locked,
  setTyping,
  editorType,
  levelIndex,
  title,
}: UseEditorTypingPresenceOptions) {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const handleTypingEndRef = useRef<() => void>(() => {});

  const handleTypingStart = useCallback(() => {
    if (isTypingRef.current) {
      return;
    }

    if (isConnected && !locked && setTyping) {
      isTypingRef.current = true;
      setTyping(editorType, levelIndex, true);
    }
  }, [editorType, isConnected, levelIndex, locked, setTyping]);

  const handleTypingEnd = useCallback(() => {
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
