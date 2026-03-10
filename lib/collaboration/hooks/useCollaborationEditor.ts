"use client";

import { useCallback, useRef } from "react";
import { EditorType, RoomStateSyncMessage } from "../types";

interface UseCollaborationEditorOptions {
  sendCursor: (editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => void;
  sendChange: (
    editorType: EditorType,
    levelIndex: number,
    baseVersion: number,
    changeSetJson: unknown,
    selection?: { from: number; to: number }
  ) => void;
}

interface UseCollaborationEditorReturn {
  updateLocalSelection: (editorType: EditorType, selection: { from: number; to: number }) => void;
  updateLocalSelectionForLevel: (editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => void;
  applyLocalChange: (
    editorType: EditorType,
    changeSetJson: unknown,
    levelIndex: number,
    baseVersion: number,
    selection?: { from: number; to: number }
  ) => void;
  setEditorVersion: (editorType: EditorType, levelIndex: number, version: number) => void;
  getEditorVersion: (editorType: EditorType, levelIndex: number) => number;
  syncEditorVersions: (payload: RoomStateSyncMessage | null) => void;
  resetEditorVersions: () => void;
}

export function useCollaborationEditor(
  options: UseCollaborationEditorOptions
): UseCollaborationEditorReturn {
  const { sendCursor, sendChange } = options;

  const versionRef = useRef<Record<string, number>>({});

  const lastSelectionRef = useRef<Record<EditorType, { from: number; to: number }>>({
    html: { from: 0, to: 0 },
    css: { from: 0, to: 0 },
    js: { from: 0, to: 0 },
  });

  const getVersionKey = useCallback((editorType: EditorType, levelIndex: number) => {
    return `${levelIndex}:${editorType}`;
  }, []);

  const updateLocalSelectionForLevel = useCallback(
    (editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => {
      const lastSelection = lastSelectionRef.current[editorType];
      if (
        lastSelection.from !== selection.from ||
        lastSelection.to !== selection.to
      ) {
        lastSelectionRef.current[editorType] = selection;
        sendCursor(editorType, levelIndex, selection);
      }
    },
    [sendCursor]
  );

  const updateLocalSelection = useCallback(
    (editorType: EditorType, selection: { from: number; to: number }) => {
      updateLocalSelectionForLevel(editorType, 0, selection);
    },
    [updateLocalSelectionForLevel]
  );

  const applyLocalChange = useCallback(
    (editorType: EditorType, changeSetJson: unknown, levelIndex: number, baseVersion: number, selection?: { from: number; to: number }) => {
      sendChange(editorType, levelIndex, baseVersion, changeSetJson, selection);
    },
    [sendChange]
  );

  const setEditorVersion = useCallback((editorType: EditorType, levelIndex: number, version: number) => {
    versionRef.current[getVersionKey(editorType, levelIndex)] = version;
  }, [getVersionKey]);

  const getEditorVersion = useCallback((editorType: EditorType, levelIndex: number) => {
    return versionRef.current[getVersionKey(editorType, levelIndex)] || 0;
  }, [getVersionKey]);

  const syncEditorVersions = useCallback((payload: RoomStateSyncMessage | null) => {
    const nextVersions: Record<string, number> = {};
    payload?.levels.forEach((level, levelIndex) => {
      nextVersions[getVersionKey("html", levelIndex)] = level.versions?.html ?? 0;
      nextVersions[getVersionKey("css", levelIndex)] = level.versions?.css ?? 0;
      nextVersions[getVersionKey("js", levelIndex)] = level.versions?.js ?? 0;
    });
    versionRef.current = nextVersions;
  }, [getVersionKey]);

  const resetEditorVersions = useCallback(() => {
    versionRef.current = {};
  }, []);

  return {
    updateLocalSelection,
    updateLocalSelectionForLevel,
    applyLocalChange,
    setEditorVersion,
    getEditorVersion,
    syncEditorVersions,
    resetEditorVersions,
  };
}
