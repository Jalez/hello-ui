import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { ChangeSet } from "@codemirror/state";
import type { ViewUpdate } from "@codemirror/view";

import type { LocalCodeAck } from "@/lib/collaboration/CollaborationProvider";
import type { EditorType } from "@/lib/collaboration/types";

interface UseEditorPatchOutboundOptions {
  isConnected: boolean;
  locked: boolean;
  applyEditorChange?: (
    editorType: EditorType,
    changeSetJson: unknown,
    levelIndex: number,
    baseVersion: number,
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
  inflightChangeSetRef: MutableRefObject<ChangeSet | null>;
  pendingSelectionRef: MutableRefObject<{ from: number; to: number }>;
  inflightSelectionRef: MutableRefObject<{ from: number; to: number } | null>;
  syncTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  suppressCollaborationUpdateRef: MutableRefObject<boolean>;
  lastSyncedCodeRef: MutableRefObject<string>;
  lastSyncedVersionRef: MutableRefObject<number>;
  retryBackoffUntilRef: MutableRefObject<number>;
  retryBackoffMsRef: MutableRefObject<number>;
  debounceMs: number;
  localCodeAcks: LocalCodeAck[];
}

export function useEditorPatchOutbound({
  isConnected,
  locked,
  applyEditorChange,
  updateEditorSelection,
  editorType,
  levelIndex,
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
  debounceMs,
  localCodeAcks,
}: UseEditorPatchOutboundOptions) {
  const lastHandledAckSeqRef = useRef(0);

  const scheduleDebouncedSync = useCallback(() => {
    if (!isConnected || locked || !applyEditorChange || !updateEditorSelection) {
      return;
    }

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    const waitMs = Math.max(debounceMs, retryBackoffUntilRef.current - Date.now(), 0);
    syncTimeoutRef.current = setTimeout(() => {
      if (inflightChangeSetRef.current) {
        return;
      }
      const nextChangeSet = pendingChangeSetRef.current;
      if (nextChangeSet) {
        inflightChangeSetRef.current = nextChangeSet;
        inflightSelectionRef.current = pendingSelectionRef.current;
        applyEditorChange(
          editorType,
          nextChangeSet.toJSON(),
          levelIndex,
          lastSyncedVersionRef.current,
          pendingSelectionRef.current,
        );
        pendingChangeSetRef.current = null;
      }

      updateEditorSelection(editorType, levelIndex, pendingSelectionRef.current);
      syncTimeoutRef.current = null;
    }, waitMs);
  }, [
    applyEditorChange,
    debounceMs,
    editorType,
    inflightChangeSetRef,
    inflightSelectionRef,
    isConnected,
    lastSyncedVersionRef,
    levelIndex,
    locked,
    pendingChangeSetRef,
    pendingSelectionRef,
    retryBackoffUntilRef,
    syncTimeoutRef,
    updateEditorSelection,
  ]);

  useEffect(() => {
    const matchingAcks = localCodeAcks.filter(
      (ack) =>
        ack.seq > lastHandledAckSeqRef.current &&
        ack.editorType === editorType &&
        ack.levelIndex === levelIndex,
    );
    if (matchingAcks.length === 0 || !inflightChangeSetRef.current) {
      return;
    }

    const latestAck = matchingAcks[matchingAcks.length - 1];
    lastHandledAckSeqRef.current = latestAck.seq;
    lastSyncedCodeRef.current = latestAck.content;
    lastSyncedVersionRef.current = latestAck.nextVersion;
    retryBackoffUntilRef.current = 0;
    retryBackoffMsRef.current = 0;
    inflightChangeSetRef.current = null;
    inflightSelectionRef.current = null;

    if (pendingChangeSetRef.current) {
      queueMicrotask(() => {
        if (!syncTimeoutRef.current) {
          scheduleDebouncedSync();
        }
      });
    }
  }, [
    editorType,
    inflightChangeSetRef,
    inflightSelectionRef,
    lastSyncedCodeRef,
    lastSyncedVersionRef,
    levelIndex,
    localCodeAcks,
    pendingChangeSetRef,
    retryBackoffMsRef,
    retryBackoffUntilRef,
    scheduleDebouncedSync,
    syncTimeoutRef,
  ]);

  useEffect(() => {
    const syncTimeout = syncTimeoutRef;
    return () => {
      if (syncTimeout.current) {
        clearTimeout(syncTimeout.current);
      }
    };
  }, [editorType, levelIndex, syncTimeoutRef]);

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

    if (
      isConnected &&
      (viewUpdate.selectionSet || (viewUpdate.docChanged && !shouldSuppressDocChange)) &&
      !inflightChangeSetRef.current
    ) {
      scheduleDebouncedSync();
    }
  }, [
    isConnected,
    inflightChangeSetRef,
    pendingChangeSetRef,
    pendingSelectionRef,
    scheduleDebouncedSync,
    suppressCollaborationUpdateRef,
  ]);

  return {
    scheduleDebouncedSync,
    handleLocalEditorUpdate,
  };
}
