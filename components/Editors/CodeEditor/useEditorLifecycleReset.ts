import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { ChangeSet } from "@codemirror/state";

interface UseEditorLifecycleResetOptions {
  enabled?: boolean;
  levelIdentifier: string;
  template: string;
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  title: "HTML" | "CSS" | "JS";
  editorType: string;
  pendingChangeSetRef: MutableRefObject<ChangeSet | null>;
  syncTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  lastSyncedCodeRef: MutableRefObject<string>;
  lastSyncedVersionRef: MutableRefObject<number>;
  retryBackoffUntilRef: MutableRefObject<number>;
  retryBackoffMsRef: MutableRefObject<number>;
  suppressCollaborationUpdateRef: MutableRefObject<boolean>;
}

export function useEditorLifecycleReset({
  enabled = true,
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
}: UseEditorLifecycleResetOptions) {
  const applyingExternalUpdateRef = useRef(false);
  const lastLevelIdentifierRef = useRef(levelIdentifier);
  const lastTemplateRef = useRef(template);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const levelChanged = lastLevelIdentifierRef.current !== levelIdentifier;
    lastLevelIdentifierRef.current = levelIdentifier;

    console.log("HOX: Level identifier changed:", {
      levelIdentifier,
      lastLevelIdentifier: lastLevelIdentifierRef.current,
      levelChanged,
    });
    if (!levelChanged) {
      return;
    }

    setCode((prev) => {
      if (prev === template) {
        return prev;
      }

      lastSyncedCodeRef.current = template;
      lastSyncedVersionRef.current = 0;
      retryBackoffUntilRef.current = 0;
      retryBackoffMsRef.current = 0;
      applyingExternalUpdateRef.current = true;
      suppressCollaborationUpdateRef.current = true;
      pendingChangeSetRef.current = null;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      return template;
    });
  }, [
    editorType,
    lastSyncedCodeRef,
    lastSyncedVersionRef,
    levelIdentifier,
    pendingChangeSetRef,
    retryBackoffMsRef,
    retryBackoffUntilRef,
    setCode,
    suppressCollaborationUpdateRef,
    syncTimeoutRef,
    template,
    title,
  ]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (!applyingExternalUpdateRef.current) {
      return;
    }

    if (code === template) {
      applyingExternalUpdateRef.current = false;
    }
  }, [code, template]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const templateChanged = lastTemplateRef.current !== template;
    lastTemplateRef.current = template;

    if (!templateChanged || code === template) {
      return;
    }

    lastSyncedCodeRef.current = template;
    lastSyncedVersionRef.current = 0;
    retryBackoffUntilRef.current = 0;
    retryBackoffMsRef.current = 0;
    applyingExternalUpdateRef.current = true;
    suppressCollaborationUpdateRef.current = true;
    pendingChangeSetRef.current = null;
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    setCode(template);
  }, [
    code,
    lastSyncedCodeRef,
    lastSyncedVersionRef,
    pendingChangeSetRef,
    retryBackoffMsRef,
    retryBackoffUntilRef,
    setCode,
    suppressCollaborationUpdateRef,
    syncTimeoutRef,
    template,
  ]);

  return {
    applyingExternalUpdateRef,
  };
}
