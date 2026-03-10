import { ChangeSet, type ChangeSet as ChangeSetType } from "@codemirror/state";
import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import type { RemoteCodeChange, RemoteCodeResync } from "@/lib/collaboration/CollaborationProvider";
import type { EditorType } from "@/lib/collaboration/types";
import { logDebugClient } from "@/lib/debug-logger";

import { applyChangeSetToContent, matchesActiveEditor, rebaseIntentChangeSet, rebasePendingChangeSet } from "./collaborationUtils";

interface UseEditorPatchInboundOptions {
  remoteCodeChanges: RemoteCodeChange[];
  remoteCodeResyncs: RemoteCodeResync[];
  editorType: EditorType;
  levelIndex: number;
  setCode: Dispatch<SetStateAction<string>>;
  pendingChangeSetRef: MutableRefObject<ChangeSetType | null>;
  inflightChangeSetRef: MutableRefObject<ChangeSetType | null>;
  syncTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  suppressCollaborationUpdateRef: MutableRefObject<boolean>;
  codeRef: MutableRefObject<string>;
  lastSyncedCodeRef: MutableRefObject<string>;
  lastSyncedVersionRef: MutableRefObject<number>;
  retryBackoffUntilRef: MutableRefObject<number>;
  retryBackoffMsRef: MutableRefObject<number>;
  inflightSelectionRef: MutableRefObject<{ from: number; to: number } | null>;
  scheduleDebouncedSync: () => void;
}

export function useEditorPatchInbound({
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
}: UseEditorPatchInboundOptions) {
  const lastAppliedRemotePatchSeqRef = useRef(0);
  const lastAppliedRemoteResyncSeqRef = useRef(0);

  useEffect(() => {
    const unseenChanges = remoteCodeChanges.filter(
      (change) =>
        change.seq > lastAppliedRemotePatchSeqRef.current &&
        matchesActiveEditor(change, editorType, levelIndex)
    );
    if (unseenChanges.length === 0) {
      return;
    }

    let nextVisibleCode: string | null = null;

    try {
      for (const change of unseenChanges) {
        const previousSyncedLength = lastSyncedCodeRef.current.length;
        const remoteChangeSet = ChangeSet.fromJSON(change.changeSetJson);
        const nextSyncedCode = applyChangeSetToContent(lastSyncedCodeRef.current, remoteChangeSet);
        lastSyncedCodeRef.current = nextSyncedCode;
        lastSyncedVersionRef.current = change.nextVersion;
        inflightChangeSetRef.current = rebasePendingChangeSet(inflightChangeSetRef.current, remoteChangeSet);
        pendingChangeSetRef.current = rebasePendingChangeSet(pendingChangeSetRef.current, remoteChangeSet);

        nextVisibleCode = nextSyncedCode;
        if (inflightChangeSetRef.current) {
          nextVisibleCode = applyChangeSetToContent(nextVisibleCode, inflightChangeSetRef.current);
        }
        if (pendingChangeSetRef.current) {
          nextVisibleCode = applyChangeSetToContent(nextVisibleCode, pendingChangeSetRef.current);
        }
        lastAppliedRemotePatchSeqRef.current = change.seq;

        logDebugClient("editor_patch_inbound_applied", {
          editorType,
          levelIndex,
          seq: change.seq,
          clientId: change.clientId,
          baseVersion: change.baseVersion,
          nextVersion: change.nextVersion,
          previousSyncedLength,
          nextSyncedLength: nextSyncedCode.length,
          nextVisibleLength: nextVisibleCode.length,
          hasPendingLocalChange: Boolean(pendingChangeSetRef.current),
        });
      }

      if (nextVisibleCode !== null) {
        suppressCollaborationUpdateRef.current = true;
        setCode((prev) => (prev === nextVisibleCode ? prev : nextVisibleCode));
      }
    } catch (error) {
      console.error("Failed to apply remote editor patch to active editor", error);
    }
  }, [
    editorType,
    inflightChangeSetRef,
    levelIndex,
    lastSyncedCodeRef,
    lastSyncedVersionRef,
    pendingChangeSetRef,
    remoteCodeChanges,
    setCode,
    suppressCollaborationUpdateRef,
  ]);

  useEffect(() => {
    const unseenResyncs = remoteCodeResyncs.filter(
      (resync) =>
        resync.seq > lastAppliedRemoteResyncSeqRef.current &&
        matchesActiveEditor(resync, editorType, levelIndex)
    );
    if (unseenResyncs.length === 0) {
      return;
    }

    const latestResync = unseenResyncs[unseenResyncs.length - 1];
    const previousSyncedContent = lastSyncedCodeRef.current;
    const intendedVisibleContent = codeRef.current;
    logDebugClient("editor_patch_inbound_resync", {
      editorType,
      levelIndex,
      seq: latestResync.seq,
      version: latestResync.version,
      contentLength: latestResync.content.length,
      pendingLocalChangeCleared: Boolean(pendingChangeSetRef.current),
      inflightLocalChangeRetried: Boolean(inflightChangeSetRef.current),
    });
    lastAppliedRemoteResyncSeqRef.current = latestResync.seq;
    lastSyncedCodeRef.current = latestResync.content;
    lastSyncedVersionRef.current = latestResync.version;
    retryBackoffMsRef.current = retryBackoffMsRef.current > 0
      ? Math.min(retryBackoffMsRef.current * 2, 1200)
      : 150;
    retryBackoffUntilRef.current = Date.now() + retryBackoffMsRef.current;
    const queuedRetry = rebaseIntentChangeSet(
      previousSyncedContent,
      latestResync.content,
      intendedVisibleContent,
    );
    const droppedPending = Boolean(pendingChangeSetRef.current);
    const droppedInflight = Boolean(inflightChangeSetRef.current);
    inflightChangeSetRef.current = null;
    inflightSelectionRef.current = null;
    pendingChangeSetRef.current = queuedRetry;
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    suppressCollaborationUpdateRef.current = true;
    setCode((prev) => (prev === latestResync.content ? prev : latestResync.content));
    logDebugClient("editor_patch_inbound_resync_canonicalized", {
      editorType,
      levelIndex,
      seq: latestResync.seq,
      version: latestResync.version,
      droppedPending,
      droppedInflight,
      retryQueued: Boolean(queuedRetry),
      intendedVisibleLength: intendedVisibleContent.length,
      previousSyncedLength: previousSyncedContent.length,
    });
    if (pendingChangeSetRef.current) {
      queueMicrotask(() => {
        scheduleDebouncedSync();
      });
    }
  }, [
    codeRef,
    editorType,
    inflightChangeSetRef,
    inflightSelectionRef,
    levelIndex,
    lastSyncedCodeRef,
    lastSyncedVersionRef,
    pendingChangeSetRef,
    remoteCodeResyncs,
    retryBackoffMsRef,
    retryBackoffUntilRef,
    scheduleDebouncedSync,
    setCode,
    suppressCollaborationUpdateRef,
    syncTimeoutRef,
  ]);
}
