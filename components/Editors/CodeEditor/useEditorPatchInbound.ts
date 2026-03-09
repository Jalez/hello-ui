import { ChangeSet, type ChangeSet as ChangeSetType } from "@codemirror/state";
import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import type { RemoteCodeChange, RemoteCodeResync } from "@/lib/collaboration/CollaborationProvider";
import type { EditorType } from "@/lib/collaboration/types";

import { applyChangeSetToContent, matchesActiveEditor, rebasePendingChangeSet } from "./collaborationUtils";

interface UseEditorPatchInboundOptions {
  remoteCodeChanges: RemoteCodeChange[];
  remoteCodeResyncs: RemoteCodeResync[];
  editorType: EditorType;
  levelIndex: number;
  setCode: Dispatch<SetStateAction<string>>;
  title: "HTML" | "CSS" | "JS";
  pendingChangeSetRef: MutableRefObject<ChangeSetType | null>;
  syncTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  suppressCollaborationUpdateRef: MutableRefObject<boolean>;
  lastSyncedCodeRef: MutableRefObject<string>;
}

export function useEditorPatchInbound({
  remoteCodeChanges,
  remoteCodeResyncs,
  editorType,
  levelIndex,
  setCode,
  title,
  pendingChangeSetRef,
  syncTimeoutRef,
  suppressCollaborationUpdateRef,
  lastSyncedCodeRef,
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
        const remoteChangeSet = ChangeSet.fromJSON(change.changeSetJson);
        const nextSyncedCode = applyChangeSetToContent(lastSyncedCodeRef.current, remoteChangeSet);
        lastSyncedCodeRef.current = nextSyncedCode;
        pendingChangeSetRef.current = rebasePendingChangeSet(pendingChangeSetRef.current, remoteChangeSet);

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
  }, [
    editorType,
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
    lastAppliedRemoteResyncSeqRef.current = latestResync.seq;
    lastSyncedCodeRef.current = latestResync.content;
    pendingChangeSetRef.current = null;
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    suppressCollaborationUpdateRef.current = true;
    setCode((prev) => (prev === latestResync.content ? prev : latestResync.content));
  }, [
    editorType,
    levelIndex,
    lastSyncedCodeRef,
    pendingChangeSetRef,
    remoteCodeResyncs,
    setCode,
    suppressCollaborationUpdateRef,
    syncTimeoutRef,
    title,
  ]);
}
