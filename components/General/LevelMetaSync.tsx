"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppStore } from "@/store/hooks/hooks";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { mergeRemoteLevelMeta } from "@/store/slices/levels.slice";

function levelMetaValueEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== "object" || typeof b !== "object") return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Applies incoming level-meta-update messages from collaborators to local
 * Redux state. Structural changes (add-level, remove-level) are handled by
 * the room-state-sync path; this component handles per-level field updates.
 */
export function LevelMetaSync() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const collaboration = useOptionalCollaboration();
  const lastAppliedTsRef = useRef<number | null>(null);

  useEffect(() => {
    const update = collaboration?.lastLevelMetaUpdate;
    if (!update) return;
    if (lastAppliedTsRef.current === update.ts) return;
    lastAppliedTsRef.current = update.ts;

    if (update.operation === "update-level-meta" && update.levelIndex != null && update.fields) {
      const level = store.getState().levels[update.levelIndex];
      if (!level) {
        console.warn("[LevelMetaSync] skip — no level at index", {
          levelIndex: update.levelIndex,
          ts: update.ts,
          keys: Object.keys(update.fields),
        });
        return;
      }

      let hasChange = false;
      let firstDiffKey: string | null = null;
      for (const [key, value] of Object.entries(update.fields)) {
        if (key === "code" || key === "versions") continue;
        const current = (level as unknown as Record<string, unknown>)[key];
        if (!levelMetaValueEqual(current, value)) {
          hasChange = true;
          firstDiffKey = key;
          break;
        }
      }
      if (!hasChange) {
        console.log("[LevelMetaSync] skip no-op merge (already matches Redux)", {
          levelIndex: update.levelIndex,
          ts: update.ts,
          keys: Object.keys(update.fields),
        });
        return;
      }

      console.log("[LevelMetaSync] applying remote update", {
        levelIndex: update.levelIndex,
        ts: update.ts,
        keys: Object.keys(update.fields),
        firstDiffKey,
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
  }, [collaboration?.lastLevelMetaUpdate, dispatch, store]);

  return null;
}
