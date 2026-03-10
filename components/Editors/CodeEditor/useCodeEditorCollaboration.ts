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
import { useYjsCodeEditorCollaboration } from "./useYjsCodeEditorCollaboration";
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
  onLocalUserInput?: () => void;
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
  onLocalUserInput,
}: UseCodeEditorCollaborationOptions) {
  const collaboration = useOptionalCollaboration();
  const isYjsEnabled = enabled && (collaboration?.isYjsEnabled ?? false);
  const yjsCollaboration = useYjsCodeEditorCollaboration({
    title,
    code,
    setCode,
    template,
    enabled: enabled && isYjsEnabled,
    locked,
    levelIdentifier,
    currentLevel,
    onLocalChange,
    onLocalUserInput,
  });

  const isConnected = enabled && !isYjsEnabled && (collaboration?.isConnected ?? false);
  const setTyping = collaboration?.setTyping;
  const applyEditorChange = collaboration?.applyEditorChange;
  const updateEditorSelection = collaboration?.updateEditorSelection;
  const editorCursors = enabled && !isYjsEnabled ? (collaboration?.editorCursors ?? EMPTY_EDITOR_CURSORS) : EMPTY_EDITOR_CURSORS;
  const remoteCodeChanges = enabled && !isYjsEnabled ? (collaboration?.remoteCodeChanges ?? EMPTY_REMOTE_CODE_CHANGES) : EMPTY_REMOTE_CODE_CHANGES;
  const remoteCodeResyncs = enabled && !isYjsEnabled ? (collaboration?.remoteCodeResyncs ?? EMPTY_REMOTE_CODE_RESYNCS) : EMPTY_REMOTE_CODE_RESYNCS;
  const localCodeAcks = enabled && !isYjsEnabled ? (collaboration?.localCodeAcks ?? []) : [];
  const getEditorVersion = collaboration?.getEditorVersion;
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
  const lastSyncedVersionRef = useRef(0);
  const retryBackoffUntilRef = useRef(0);
  const retryBackoffMsRef = useRef(0);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    if (!enabled || isYjsEnabled || !getEditorVersion) {
      return;
    }
    lastSyncedVersionRef.current = getEditorVersion(editorType, levelIndex);
  }, [editorType, enabled, getEditorVersion, isYjsEnabled, levelIndex, collaboration?.codeSyncReady]);

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
    lastSyncedVersionRef,
    retryBackoffUntilRef,
    retryBackoffMsRef,
    debounceMs: REMOTE_SYNC_DEBOUNCE_MS,
    localCodeAcks,
  });

  useEditorPatchInbound({
    remoteCodeChanges,
    remoteCodeResyncs,
    editorType,
    levelIndex,
    setCode,
    pendingChangeSetRef,
    inflightChangeSetRef,
    syncTimeoutRef,
    suppressCollaborationUpdateRef,
    codeRef,
    lastSyncedCodeRef,
    lastSyncedVersionRef,
    retryBackoffUntilRef,
    retryBackoffMsRef,
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
    lastSyncedVersionRef,
    retryBackoffUntilRef,
    retryBackoffMsRef,
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

  const customCollaboration = {
    isConnected,
    remoteCarets,
    editorViewRef,
    editorViewportRef,
    applyingExternalUpdateRef,
    isYjsManaged: false,
    editorExtensions: [],
    editorKey: `custom-${levelIdentifier}-${title}-${currentLevel}`,
    editorInitialState: undefined,
    handleCodeUpdate,
    handleEditorCreate: (view: EditorView) => {
      editorViewRef.current = view;
    },
    handleEditorUpdate,
  };

  return isYjsEnabled ? yjsCollaboration : customCollaboration;
}
