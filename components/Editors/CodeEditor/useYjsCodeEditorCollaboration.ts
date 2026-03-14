import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import { yCollab } from "y-codemirror.next";

import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import type { EditorType } from "@/lib/collaboration/types";

import { TYPING_IDLE_MS } from "./constants";
import { useEditorTypingPresence } from "./useEditorTypingPresence";
import { useRemoteCarets } from "./useRemoteCarets";
import { EMPTY_EDITOR_CURSORS, titleToEditorType } from "./utils";

interface UseYjsCodeEditorCollaborationOptions {
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

export function useYjsCodeEditorCollaboration({
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
}: UseYjsCodeEditorCollaborationOptions) {
  const collaboration = useOptionalCollaboration();
  const isConnected = enabled && (collaboration?.isConnected ?? false);
  const setTyping = collaboration?.setTyping;
  const updateEditorSelection = collaboration?.updateEditorSelection;
  const editorCursors = enabled ? (collaboration?.editorCursors ?? EMPTY_EDITOR_CURSORS) : EMPTY_EDITOR_CURSORS;
  const getYText = collaboration?.getYText;
  const reportEditorWatchState = collaboration?.reportEditorWatchState;
  const editorType: EditorType = titleToEditorType(title);
  const levelIndex = currentLevel - 1;
  const yjsDocGeneration = collaboration?.yjsDocGeneration ?? 0;
  const yText = enabled ? getYText?.(editorType, levelIndex) ?? null : null;

  const editorViewRef = useRef<EditorView | null>(null);
  const editorViewportRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef(code);
  const applyingExternalUpdateRef = useRef(false);
  const lastObservedYTextValueRef = useRef<string | null>(null);
  const codeUpdateOriginRef = useRef<"editor" | "yjs" | null>(null);

  const editorKey = `${levelIdentifier}:${editorType}:${levelIndex}`;
  const [editorMountValue] = useState(() => {
    return yText?.toString() ?? code ?? template;
  });

  const editorExtensions = useMemo<Extension[]>(() => {
    if (!enabled || !yText) {
      return [];
    }
    return [yCollab(yText, null, { undoManager: false })];
  }, [enabled, yText]);

  const editorInitialState = useMemo(() => {
    return {
      json: EditorState.create({
        doc: enabled && yText ? yText.toString() : editorMountValue,
      }).toJSON(),
    };
  }, [editorMountValue, enabled, yText]);

  useEffect(() => {
    if (lastObservedYTextValueRef.current == null) {
      lastObservedYTextValueRef.current = editorMountValue;
    }
  }, [editorMountValue, editorType, levelIndex]);

  const { typingTimeoutRef: typingPresenceTimeoutRef, handleTypingStart, handleTypingEnd } = useEditorTypingPresence({
    isConnected,
    locked,
    setTyping,
    editorType,
    levelIndex,
    title,
  });

  useEffect(() => {
    typingTimeoutRef.current = typingPresenceTimeoutRef.current;
  }, [typingPresenceTimeoutRef]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!isConnected || !yText) {
      return;
    }

    const syncReactCode = (nextValue: string, markExternal = false, origin: string = "yjs") => {
      lastObservedYTextValueRef.current = nextValue;
      codeRef.current = nextValue;
      codeUpdateOriginRef.current = "yjs";
      console.log("[yjs-editor:sync-react]", {
        editorType,
        levelIndex,
        origin,
        nextLen: nextValue.length,
        viewLen: editorViewRef.current?.state.doc.length ?? null,
      });
      setCode((prev) => (prev === nextValue ? prev : nextValue));
      reportEditorWatchState?.({
        editorType,
        levelIndex,
        content: nextValue,
        version: null,
        isEditable: !locked,
        isFocused: editorViewRef.current?.hasFocus ?? false,
        isTyping: false,
        source: origin === "initial" ? "room_sync" : "remote_apply",
      });
      if (markExternal) {
        applyingExternalUpdateRef.current = true;
        queueMicrotask(() => {
          applyingExternalUpdateRef.current = false;
        });
      }
    };

    syncReactCode(yText.toString(), false, "initial");

    const observer = (event: { target: { toString(): string } }, transaction: { origin: unknown }) => {
      const nextValue = event.target.toString();
      console.log("[yjs-editor:ytext-observe]", {
        editorType,
        levelIndex,
        txOrigin: String(transaction.origin),
        nextLen: nextValue.length,
        viewLen: editorViewRef.current?.state.doc.length ?? null,
        reactLen: codeRef.current.length,
      });
      if (transaction.origin === "external-code-state") {
        syncReactCode(nextValue, false, "external-code-state");
        return;
      }
      syncReactCode(nextValue, true, String(transaction.origin));
    };

    yText.observe(observer);
    return () => {
      yText.unobserve(observer);
    };
  }, [editorType, enabled, isConnected, levelIdentifier, levelIndex, locked, reportEditorWatchState, setCode, template, yText]);

  useEffect(() => {
    codeRef.current = code;
    if (codeUpdateOriginRef.current) {
      codeUpdateOriginRef.current = null;
    }
  }, [code]);

  const { remoteCarets } = useRemoteCarets({
    editorViewRef,
    editorViewportRef,
    editorCursors,
    editorType,
    levelIndex,
    isConnected,
    code,
  });

  const handleCodeUpdate = useCallback(() => {
    // Yjs-managed editors use CodeMirror updates as the source of truth.
  }, []);

  const handleEditorUpdate = useCallback((viewUpdate: ViewUpdate) => {
    if (!viewUpdate.view) {
      return;
    }

    const selection = viewUpdate.state.selection.main;
    updateEditorSelection?.(editorType, levelIndex, { from: selection.from, to: selection.to });

    if (!viewUpdate.docChanged) {
      return;
    }
    const nextValue = viewUpdate.state.doc.toString();
    if (codeRef.current === nextValue) {
      return;
    }
    const isLocalUserInput = viewUpdate.transactions.some(
      (transaction) =>
        transaction.docChanged &&
        (transaction.isUserEvent("input") ||
          transaction.isUserEvent("delete") ||
          transaction.isUserEvent("move") ||
          transaction.isUserEvent("select"))
    );
    console.log("[yjs-editor:view-update]", {
      editorType,
      levelIndex,
      docChanged: viewUpdate.docChanged,
      nextLen: nextValue.length,
      prevReactLen: codeRef.current.length,
      yTextLen: yText?.toString().length ?? null,
      local: isLocalUserInput,
      applyingExternal: applyingExternalUpdateRef.current,
    });
    codeRef.current = nextValue;
    codeUpdateOriginRef.current = "editor";
    setCode((prev) => (prev === nextValue ? prev : nextValue));
    reportEditorWatchState?.({
      editorType,
      levelIndex,
      content: nextValue,
      version: null,
      isEditable: !locked,
      isFocused: viewUpdate.view.hasFocus,
      isTyping: isLocalUserInput,
      source: isLocalUserInput ? "local_input" : "remote_apply",
    });

    if (!isLocalUserInput || applyingExternalUpdateRef.current || locked) {
      return;
    }

    onLocalChange?.();
    onLocalUserInput?.();

    if (!isConnected) {
      return;
    }

    handleTypingStart();
    if (typingPresenceTimeoutRef.current) {
      clearTimeout(typingPresenceTimeoutRef.current);
    }
    typingPresenceTimeoutRef.current = setTimeout(() => {
      handleTypingEnd();
    }, TYPING_IDLE_MS);
  }, [
    editorType,
    handleTypingEnd,
    handleTypingStart,
    isConnected,
    levelIndex,
    locked,
    onLocalChange,
    onLocalUserInput,
    reportEditorWatchState,
    setCode,
    typingPresenceTimeoutRef,
    updateEditorSelection,
    yText,
  ]);

  return {
    isConnected,
    remoteCarets,
    editorViewRef,
    editorViewportRef,
    applyingExternalUpdateRef,
    isYjsManaged: true,
    editorExtensions,
    editorKey: `yjs-${editorKey}:g${yjsDocGeneration}`,
    editorInitialState,
    handleCodeUpdate,
    handleEditorCreate: (view: EditorView) => {
      editorViewRef.current = view;
      reportEditorWatchState?.({
        editorType,
        levelIndex,
        content: codeRef.current,
        version: null,
        isEditable: !locked,
        isFocused: view.hasFocus,
        isTyping: false,
        source: "focus",
      });
    },
    handleEditorUpdate,
  };
}
