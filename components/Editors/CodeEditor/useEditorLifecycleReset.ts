import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { ChangeSet } from "@codemirror/state";

interface UseEditorLifecycleResetOptions {
  levelIdentifier: string;
  template: string;
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  title: "HTML" | "CSS" | "JS";
  editorType: string;
  pendingChangeSetRef: MutableRefObject<ChangeSet | null>;
  syncTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  lastSyncedCodeRef: MutableRefObject<string>;
  suppressCollaborationUpdateRef: MutableRefObject<boolean>;
}

export function useEditorLifecycleReset({
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
}: UseEditorLifecycleResetOptions) {
  const applyingExternalUpdateRef = useRef(false);
  const lastLevelIdentifierRef = useRef(levelIdentifier);

  useEffect(() => {
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
    levelIdentifier,
    pendingChangeSetRef,
    setCode,
    suppressCollaborationUpdateRef,
    syncTimeoutRef,
    template,
    title,
  ]);

  useEffect(() => {
    if (!applyingExternalUpdateRef.current) {
      return;
    }

    if (code === template) {
      applyingExternalUpdateRef.current = false;
    }
  }, [code, template]);

  return {
    applyingExternalUpdateRef,
  };
}
