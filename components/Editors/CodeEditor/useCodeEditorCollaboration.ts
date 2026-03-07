import { ChangeSet, Text as CodeMirrorText } from "@codemirror/state";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { EditorView, ViewUpdate } from "@codemirror/view";

import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import type { EditorCursor } from "@/lib/collaboration/types";

import { REMOTE_SYNC_DEBOUNCE_MS, TYPING_IDLE_MS } from "./constants";
import type { RemoteEditorCaret } from "./types";
import { EMPTY_EDITOR_CURSORS, areRemoteCaretsEqual, titleToEditorType } from "./utils";

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

function applyChangeSetToContent(content: string, changeSet: ChangeSet) {
  return changeSet.apply(CodeMirrorText.of(content.split("\n"))).toString();
}

function buildRemoteCarets(
  view: EditorView,
  viewport: HTMLDivElement,
  editorCursors: Map<string, EditorCursor>,
  editorType: ReturnType<typeof titleToEditorType>,
  levelIndex: number,
) {
  const viewportRect = viewport.getBoundingClientRect();
  const docLen = view.state.doc.length;
  const nextCarets: RemoteEditorCaret[] = [];

  for (const [id, cursor] of editorCursors.entries()) {
    if (cursor.editorType !== editorType || cursor.levelIndex !== levelIndex) {
      continue;
    }

    const rawPos = cursor.selection?.to ?? cursor.selection?.from ?? 0;
    const pos = Math.max(0, Math.min(rawPos, docLen));
    const coords = view.coordsAtPos(pos);
    if (!coords) {
      continue;
    }

    nextCarets.push({
      id,
      x: coords.left - viewportRect.left,
      y: coords.top - viewportRect.top,
      color: cursor.color,
    });
  }

  return nextCarets.slice(0, 12);
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
  const editorType = titleToEditorType(title);

  const editorViewRef = useRef<EditorView | null>(null);
  const editorViewportRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const pendingChangeSetRef = useRef<ChangeSet | null>(null);
  const pendingSelectionRef = useRef({ from: 0, to: 0 });
  const suppressCollaborationUpdateRef = useRef(false);
  const applyingExternalUpdateRef = useRef(false);
  const codeRef = useRef(template);
  const lastSyncedCodeRef = useRef(template);
  const lastAppliedRemotePatchSeqRef = useRef<number>(0);
  const lastAppliedRemoteResyncSeqRef = useRef<number>(0);
  const lastLevelIdentifierRef = useRef(levelIdentifier);
  const [remoteCarets, setRemoteCarets] = useState<RemoteEditorCaret[]>([]);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const handleTypingStart = useCallback(() => {
    if (isTypingRef.current) {
      return;
    }

    if (isConnected && !locked && setTyping) {
      isTypingRef.current = true;
      setTyping(editorType, currentLevel - 1, true);
    }
  }, [currentLevel, editorType, isConnected, locked, setTyping]);

  const handleTypingEnd = useCallback(() => {
    if (!isTypingRef.current) {
      return;
    }

    isTypingRef.current = false;
    if (isConnected && setTyping) {
      setTyping(editorType, currentLevel - 1, false);
    }
  }, [currentLevel, editorType, isConnected, setTyping]);

  useEffect(() => {
    return () => {
      handleTypingEnd();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [handleTypingEnd]);

  const scheduleDebouncedSync = useCallback(() => {
    if (!isConnected || locked || !applyEditorChange || !updateEditorSelection) {
      return;
    }

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      const nextChangeSet = pendingChangeSetRef.current;
      if (nextChangeSet) {
        lastSyncedCodeRef.current = codeRef.current;
        applyEditorChange(editorType, nextChangeSet.toJSON(), currentLevel - 1, pendingSelectionRef.current);
        pendingChangeSetRef.current = null;
      }

      updateEditorSelection(editorType, currentLevel - 1, pendingSelectionRef.current);
    }, REMOTE_SYNC_DEBOUNCE_MS);
  }, [applyEditorChange, currentLevel, editorType, isConnected, locked, updateEditorSelection]);

  useEffect(() => {
    const activeLevelIndex = currentLevel - 1;
    const unseenChanges = remoteCodeChanges.filter(
      (change) =>
        change.seq > lastAppliedRemotePatchSeqRef.current &&
        change.editorType === editorType &&
        change.levelIndex === activeLevelIndex
    );
    if (unseenChanges.length === 0) {
      return;
    }

    let nextVisibleCode: string | null = null;

    try {
      for (const change of unseenChanges) {
        const remoteChangeSet = ChangeSet.fromJSON(change.changeSetJson);
        const nextSyncedCode = applyChangeSetToContent(lastSyncedCodeRef.current, remoteChangeSet);
        lastSyncedCodeRef.current = nextSyncedCode;

        if (pendingChangeSetRef.current) {
          pendingChangeSetRef.current = pendingChangeSetRef.current.map(remoteChangeSet);
        }

        nextVisibleCode = pendingChangeSetRef.current
          ? applyChangeSetToContent(nextSyncedCode, pendingChangeSetRef.current)
          : nextSyncedCode;
        lastAppliedRemotePatchSeqRef.current = change.seq;
      }

      if (nextVisibleCode !== null) {
        suppressCollaborationUpdateRef.current = true;
        setCode((prev) => (prev === nextVisibleCode ? prev : nextVisibleCode));
      }
    } catch (error) {
      console.error("Failed to apply remote editor patch to active editor", error);
    }
  }, [currentLevel, editorType, remoteCodeChanges, setCode]);

  useEffect(() => {
    const activeLevelIndex = currentLevel - 1;
    const unseenResyncs = remoteCodeResyncs.filter(
      (resync) =>
        resync.seq > lastAppliedRemoteResyncSeqRef.current &&
        resync.editorType === editorType &&
        resync.levelIndex === activeLevelIndex
    );
    if (unseenResyncs.length === 0) {
      return;
    }

    const latestResync = unseenResyncs[unseenResyncs.length - 1];
    lastAppliedRemoteResyncSeqRef.current = latestResync.seq;
    lastSyncedCodeRef.current = latestResync.content;
    pendingChangeSetRef.current = null;
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    suppressCollaborationUpdateRef.current = true;
    setCode((prev) => (prev === latestResync.content ? prev : latestResync.content));
  }, [currentLevel, editorType, remoteCodeResyncs, setCode]);

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

      const nextCarets = buildRemoteCarets(view, viewport, editorCursors, editorType, currentLevel - 1);
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
  }, [code, currentLevel, editorCursors, editorType, isConnected, remoteCarets.length]);

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
  }, [handleTypingEnd, handleTypingStart, isConnected, locked, onLocalChange, scheduleDebouncedSync, setCode]);

  const handleEditorUpdate = useCallback((viewUpdate: ViewUpdate) => {
    const selection = viewUpdate.state.selection.main;
    const shouldSuppressDocChange = viewUpdate.docChanged && suppressCollaborationUpdateRef.current;
    pendingSelectionRef.current = {
      from: selection.from,
      to: selection.to,
    };

    if (shouldSuppressDocChange) {
      suppressCollaborationUpdateRef.current = false;
    } else if (viewUpdate.docChanged) {
      pendingChangeSetRef.current = pendingChangeSetRef.current
        ? pendingChangeSetRef.current.compose(viewUpdate.changes)
        : viewUpdate.changes;
    }

    if (isConnected && (viewUpdate.selectionSet || (viewUpdate.docChanged && !shouldSuppressDocChange))) {
      scheduleDebouncedSync();
    }

    if (viewUpdate.docChanged || viewUpdate.selectionSet || viewUpdate.viewportChanged) {
      const view = editorViewRef.current;
      const viewport = editorViewportRef.current;
      if (!view || !viewport) {
        return;
      }

      const nextCarets = buildRemoteCarets(view, viewport, editorCursors, editorType, currentLevel - 1);
      setRemoteCarets((prev) => (areRemoteCaretsEqual(prev, nextCarets) ? prev : nextCarets));
    }
  }, [currentLevel, editorCursors, editorType, isConnected, scheduleDebouncedSync]);

  useEffect(() => {
    const levelChanged = lastLevelIdentifierRef.current !== levelIdentifier;
    lastLevelIdentifierRef.current = levelIdentifier;

    setCode((prev) => {
      if (!levelChanged && prev === template) {
        return prev;
      }

      lastSyncedCodeRef.current = template;
      applyingExternalUpdateRef.current = true;
      suppressCollaborationUpdateRef.current = true;
      pendingChangeSetRef.current = null;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      return template;
    });
  }, [levelIdentifier, setCode, template]);

  useEffect(() => {
    if (!applyingExternalUpdateRef.current) {
      return;
    }

    if (code === template) {
      applyingExternalUpdateRef.current = false;
    }
  }, [code, template]);

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
