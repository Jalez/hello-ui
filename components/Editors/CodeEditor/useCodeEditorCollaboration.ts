import { ChangeSet } from "@codemirror/state";
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { EditorView, ViewUpdate } from "@codemirror/view";

import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import type { EditorType } from "@/lib/collaboration/types";

import { REMOTE_SYNC_DEBOUNCE_MS, TYPING_IDLE_MS } from "./constants";
import { useEditorLifecycleReset } from "./useEditorLifecycleReset";
import { useEditorPatchInbound } from "./useEditorPatchInbound";
import { useEditorPatchOutbound } from "./useEditorPatchOutbound";
import { useEditorTypingPresence } from "./useEditorTypingPresence";
import { useRemoteCarets } from "./useRemoteCarets";
import { EMPTY_EDITOR_CURSORS, titleToEditorType } from "./utils";

const EMPTY_REMOTE_CODE_CHANGES: NonNullable<ReturnType<typeof useOptionalCollaboration>>["remoteCodeChanges"] = [];
const EMPTY_REMOTE_CODE_RESYNCS: NonNullable<ReturnType<typeof useOptionalCollaboration>>["remoteCodeResyncs"] = [];

interface UseCodeEditorCollaborationOptions {
  title: "HTML" | "CSS" | "JS";
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  template: string;
  enabled?: boolean;
  locked: boolean;
  levelIdentifier: string;
  currentLevel: number;
  onLocalChange?: () => void;
}

export function useCodeEditorCollaboration({
  title,
  code,
  setCode,
  template,
  enabled = true,
  locked,
  levelIdentifier,
  currentLevel,
  onLocalChange,
}: UseCodeEditorCollaborationOptions) {
  const collaboration = useOptionalCollaboration();
  const isConnected = enabled && (collaboration?.isConnected ?? false);
  const setTyping = collaboration?.setTyping;
  const applyEditorChange = collaboration?.applyEditorChange;
  const updateEditorSelection = collaboration?.updateEditorSelection;
  const editorCursors = enabled ? (collaboration?.editorCursors ?? EMPTY_EDITOR_CURSORS) : EMPTY_EDITOR_CURSORS;
  const remoteCodeChanges = enabled ? (collaboration?.remoteCodeChanges ?? EMPTY_REMOTE_CODE_CHANGES) : EMPTY_REMOTE_CODE_CHANGES;
  const remoteCodeResyncs = enabled ? (collaboration?.remoteCodeResyncs ?? EMPTY_REMOTE_CODE_RESYNCS) : EMPTY_REMOTE_CODE_RESYNCS;
  const localCodeAcks = enabled ? (collaboration?.localCodeAcks ?? []) : [];
  const editorType: EditorType = titleToEditorType(title);
  const levelIndex = currentLevel - 1;

  const editorViewRef = useRef<EditorView | null>(null);
  const editorViewportRef = useRef<HTMLDivElement | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChangeSetRef = useRef<ChangeSet | null>(null);
  const inflightChangeSetRef = useRef<ChangeSet | null>(null);
  const pendingSelectionRef = useRef({ from: 0, to: 0 });
  const inflightSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const suppressCollaborationUpdateRef = useRef(false);
  const codeRef = useRef(template);
  const lastSyncedCodeRef = useRef(template);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const { typingTimeoutRef, handleTypingStart, handleTypingEnd } = useEditorTypingPresence({
    isConnected,
    locked,
    setTyping,
    editorType,
    levelIndex,
    title,
  });

  const { scheduleDebouncedSync, handleLocalEditorUpdate } = useEditorPatchOutbound({
    isConnected,
    locked,
    applyEditorChange,
    updateEditorSelection,
    editorType,
    levelIndex,
    title,
    codeRef,
    pendingChangeSetRef,
    inflightChangeSetRef,
    pendingSelectionRef,
    inflightSelectionRef,
    syncTimeoutRef,
    suppressCollaborationUpdateRef,
    lastSyncedCodeRef,
    debounceMs: REMOTE_SYNC_DEBOUNCE_MS,
    localCodeAcks,
  });

  useEditorPatchInbound({
    remoteCodeChanges,
    remoteCodeResyncs,
    editorType,
    levelIndex,
    setCode,
    title,
    pendingChangeSetRef,
    inflightChangeSetRef,
    syncTimeoutRef,
    suppressCollaborationUpdateRef,
    lastSyncedCodeRef,
    inflightSelectionRef,
    scheduleDebouncedSync,
  });

  const { applyingExternalUpdateRef } = useEditorLifecycleReset({
    levelIdentifier,
    template,
    code,
    setCode,
    title,
    editorType,
    pendingChangeSetRef,
    syncTimeoutRef,
    lastSyncedCodeRef,
    suppressCollaborationUpdateRef,
  });

  const { remoteCarets } = useRemoteCarets({
    editorViewRef,
    editorViewportRef,
    editorCursors,
    editorType,
    levelIndex,
    isConnected,
    code,
  });

  const handleCodeUpdate = useCallback((value: string) => {
    if (locked) {
      return;
    }
    onLocalChange?.();
    setCode(value);

    if (!isConnected) {
      return;
    }

    handleTypingStart();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingEnd();
    }, TYPING_IDLE_MS);
    scheduleDebouncedSync();
  }, [handleTypingEnd, handleTypingStart, isConnected, locked, onLocalChange, scheduleDebouncedSync, setCode, typingTimeoutRef]);

  const handleEditorUpdate = useCallback((viewUpdate: ViewUpdate) => {
    handleLocalEditorUpdate(viewUpdate);
  }, [handleLocalEditorUpdate]);

  return {
    isConnected,
    remoteCarets,
    editorViewRef,
    editorViewportRef,
    applyingExternalUpdateRef,
    handleCodeUpdate,
    handleEditorCreate: (view: EditorView) => {
      editorViewRef.current = view;
    },
    handleEditorUpdate,
  };
}
