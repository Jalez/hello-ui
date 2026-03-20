"use client";

import { useCallback } from "react";
import { useOptionalCollaboration } from "../CollaborationProvider";
import { useAppStore } from "@/store/hooks/hooks";
import type { LevelMetaOperation } from "../types";

/**
 * Returns helpers for syncing level metadata changes with collaborators.
 *
 * `syncLevelFields` — after dispatching a Redux action that mutates a level,
 * call this with the 0-based level index and field names to sync. It reads
 * the post-dispatch Redux state and sends only the specified fields.
 *
 * `syncLevelOp` — for structural operations (add-level, remove-level).
 */
export function useLevelMetaSync() {
  const collaboration = useOptionalCollaboration();
  const store = useAppStore();

  const syncLevelFields = useCallback(
    (levelIndex: number, fieldNames: string[]) => {
      if (!collaboration?.sendLevelMetaUpdate) return;
      const level = store.getState().levels[levelIndex];
      if (!level) return;
      const fields: Record<string, unknown> = {};
      for (const key of fieldNames) {
        fields[key] = (level as unknown as Record<string, unknown>)[key];
      }
      collaboration.sendLevelMetaUpdate("update-level-meta", {
        levelIndex,
        fields,
      });
    },
    [collaboration, store]
  );

  const syncLevelOp = useCallback(
    (
      operation: LevelMetaOperation,
      opts?: { levelIndex?: number; level?: Record<string, unknown> }
    ) => {
      collaboration?.sendLevelMetaUpdate(operation, opts);
    },
    [collaboration]
  );

  return { syncLevelFields, syncLevelOp };
}
