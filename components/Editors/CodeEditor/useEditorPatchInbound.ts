import { ChangeSet, type ChangeSet as ChangeSetType } from "@codemirror/state";
import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import type { RemoteCodeChange, RemoteCodeResync } from "@/lib/collaboration/CollaborationProvider";
import type { EditorType } from "@/lib/collaboration/types";
import { logDebugClient } from "@/lib/debug-logger";

import { applyChangeSetToContent, matchesActiveEditor, rebasePendingChangeSet } from "./collaborationUtils";

interface UseEditorPatchInboundOptions {
  remoteCodeChanges: RemoteCodeChange[];
  remoteCodeResyncs: RemoteCodeResync[];
  editorType: EditorType;
  levelIndex: number;
  setCode: Dispatch<SetStateAction<string>>;
  title: "HTML" | "CSS" | "JS";
  pendingChangeSetRef: MutableRefObject<ChangeSetType | null>;
  inflightChangeSetRef: MutableRefObject<ChangeSetType | null>;
  syncTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  suppressCollaborationUpdateRef: MutableRefObject<boolean>;
  lastSyncedCodeRef: MutableRefObject<string>;
  inflightSelectionRef: MutableRefObject<{ from: number; to: number } | null>;
  scheduleDebouncedSync: () => void;
}

export function useEditorPatchInbound({
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
    const rejectedInflightChange = inflightChangeSetRef.current;
    const nextPending = rejectedInflightChange
      ? (pendingChangeSetRef.current
        ? rejectedInflightChange.compose(pendingChangeSetRef.current)
        : rejectedInflightChange)
      : pendingChangeSetRef.current;
    inflightChangeSetRef.current = null;
    inflightSelectionRef.current = null;
    pendingChangeSetRef.current = nextPending;
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    suppressCollaborationUpdateRef.current = true;
    let nextVisibleCode = latestResync.content;
    if (pendingChangeSetRef.current) {
      nextVisibleCode = applyChangeSetToContent(nextVisibleCode, pendingChangeSetRef.current);
    }
    setCode((prev) => (prev === nextVisibleCode ? prev : nextVisibleCode));
    if (pendingChangeSetRef.current) {
      queueMicrotask(() => {
        scheduleDebouncedSync();
      });
    }
  }, [
    editorType,
    inflightChangeSetRef,
    inflightSelectionRef,
    levelIndex,
    lastSyncedCodeRef,
    pendingChangeSetRef,
    remoteCodeResyncs,
    scheduleDebouncedSync,
    setCode,
    suppressCollaborationUpdateRef,
    syncTimeoutRef,
    title,
  ]);
}
