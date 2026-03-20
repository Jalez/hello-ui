"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { mergeRemoteLevelMeta } from "@/store/slices/levels.slice";

/**
 * Applies incoming level-meta-update messages from collaborators to local
 * Redux state. Structural changes (add-level, remove-level) are handled by
 * the room-state-sync path; this component handles per-level field updates.
 */
export function LevelMetaSync() {
  const dispatch = useAppDispatch();
  const collaboration = useOptionalCollaboration();
  const lastAppliedTsRef = useRef<number | null>(null);

  useEffect(() => {
    const update = collaboration?.lastLevelMetaUpdate;
    if (!update) return;
    if (lastAppliedTsRef.current === update.ts) return;
    lastAppliedTsRef.current = update.ts;

    if (update.operation === "update-level-meta" && update.levelIndex != null && update.fields) {
      console.log("[LevelMetaSync] applying remote update", {
        operation: update.operation,
        levelIndex: update.levelIndex,
        keys: Object.keys(update.fields),
      });
      dispatch(
        mergeRemoteLevelMeta({
          levelIndex: update.levelIndex,
          fields: update.fields,
        })
      );
    }
    // add-level and remove-level trigger a room-state-sync from the server,
    // which is handled by the existing App.tsx room state sync path.
  }, [collaboration?.lastLevelMetaUpdate, dispatch]);

  return null;
}
