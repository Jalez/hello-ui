import { useCallback, useEffect, type MutableRefObject } from "react";
import type { ChangeSet } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";

import type { EditorType } from "@/lib/collaboration/types";

interface UseEditorPatchOutboundOptions {
  isConnected: boolean;
  locked: boolean;
  applyEditorChange?: (
    editorType: EditorType,
    changeSetJson: unknown,
    levelIndex: number,
    selection?: { from: number; to: number }
  ) => void;
  updateEditorSelection?: (
    editorType: EditorType,
    levelIndex: number,
    selection: { from: number; to: number }
  ) => void;
  editorType: EditorType;
  levelIndex: number;
  title: "HTML" | "CSS" | "JS";
  codeRef: MutableRefObject<string>;
  pendingChangeSetRef: MutableRefObject<ChangeSet | null>;
  pendingSelectionRef: MutableRefObject<{ from: number; to: number }>;
  syncTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  suppressCollaborationUpdateRef: MutableRefObject<boolean>;
  lastSyncedCodeRef: MutableRefObject<string>;
  debounceMs: number;
}

export function useEditorPatchOutbound({
  isConnected,
  locked,
  applyEditorChange,
  updateEditorSelection,
  editorType,
  levelIndex,
  title,
  codeRef,
  pendingChangeSetRef,
  pendingSelectionRef,
  syncTimeoutRef,
  suppressCollaborationUpdateRef,
  lastSyncedCodeRef,
  debounceMs,
}: UseEditorPatchOutboundOptions) {
  useEffect(() => {
    const syncTimeout = syncTimeoutRef;
    return () => {
      if (syncTimeout.current) {
        clearTimeout(syncTimeout.current);
      }
    };
  }, [editorType, levelIndex, syncTimeoutRef, title]);

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
        applyEditorChange(editorType, nextChangeSet.toJSON(), levelIndex, pendingSelectionRef.current);
        pendingChangeSetRef.current = null;
      }

      updateEditorSelection(editorType, levelIndex, pendingSelectionRef.current);
    }, debounceMs);
  }, [
    applyEditorChange,
    codeRef,
    debounceMs,
    editorType,
    isConnected,
    lastSyncedCodeRef,
    levelIndex,
    locked,
    pendingChangeSetRef,
    pendingSelectionRef,
    syncTimeoutRef,
    title,
    updateEditorSelection,
  ]);

  const handleLocalEditorUpdate = useCallback((viewUpdate: ViewUpdate) => {
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
  }, [
    editorType,
    isConnected,
    levelIndex,
    pendingChangeSetRef,
    pendingSelectionRef,
    scheduleDebouncedSync,
    suppressCollaborationUpdateRef,
    title,
  ]);

  return {
    scheduleDebouncedSync,
    handleLocalEditorUpdate,
  };
}
