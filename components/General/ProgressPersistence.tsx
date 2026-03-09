"use client";

import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { apiUrl } from "@/lib/apiUrl";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { mergeSavedPoints } from "@/store/slices/points.slice";

const SAVE_DEBOUNCE_MS = 2000;

function sanitizeReplayProgressData(progressData: Record<string, unknown>, replaying: boolean) {
  const sanitized = Object.fromEntries(
    Object.entries(progressData).filter(([key]) => key !== "levels")
  );

  if (replaying) {
    delete sanitized.finishedAt;
    delete sanitized.finalScore;
  }

  return sanitized;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`);

  return `{${entries.join(",")}}`;
}

/**
 * When on a gameplay route, persists non-code progress to the game instance.
 * Code is owned by websocket room state and must not be written through HTTP here.
 */
export function ProgressPersistence() {
  const dispatch = useAppDispatch();
  const params = useParams();
  const searchParams = useSearchParams();
  const levels = useAppSelector((state) => state.levels);
  const points = useAppSelector((state) => state.points);
  const mode = useAppSelector((state) => state.options.mode);
  const currentGame = useGameStore((s) => s.getCurrentGame());
  const addGameToStore = useGameStore((s) => s.addGameToStore);
  const collaboration = useOptionalCollaboration();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const inFlightSnapshotRef = useRef<string | null>(null);
  const lastAppliedProgressSyncTsRef = useRef<number | null>(null);

  const gameId = typeof params?.gameId === "string" ? params.gameId : Array.isArray(params?.gameId) ? params.gameId[0] : null;
  const isReplayView = searchParams.get("view") === "play";

  useEffect(() => {
    lastSavedSnapshotRef.current = null;
    inFlightSnapshotRef.current = null;
    lastAppliedProgressSyncTsRef.current = null;
  }, [gameId, currentGame?.id]);

  useEffect(() => {
    const syncMessage = collaboration?.lastProgressSync;
    const syncedProgressData = syncMessage?.progressData;
    if (!syncMessage || !syncedProgressData || mode !== "game" || !currentGame) {
      return;
    }

    if (lastAppliedProgressSyncTsRef.current === syncMessage.ts) {
      return;
    }

    const mergedProgressData = sanitizeReplayProgressData({
      ...(typeof currentGame.progressData === "object" && currentGame.progressData !== null ? currentGame.progressData : {}),
      ...syncedProgressData,
    }, isReplayView);

    const currentProgressSnapshot = stableSerialize(currentGame.progressData ?? {});
    const mergedProgressSnapshot = stableSerialize(mergedProgressData);

    lastAppliedProgressSyncTsRef.current = syncMessage.ts;

    if (currentProgressSnapshot !== mergedProgressSnapshot) {
      console.log("[ProgressPersistence] applying remote progress sync", {
        ts: syncMessage.ts,
        isReplayView,
        keys: Object.keys(syncedProgressData),
        mergedKeys: Object.keys(mergedProgressData),
      });
      addGameToStore({
        ...currentGame,
        progressData: mergedProgressData,
      });
    }

    const pointsByLevel = syncedProgressData.pointsByLevel;
    if (pointsByLevel && typeof pointsByLevel === "object" && !Array.isArray(pointsByLevel)) {
      dispatch(mergeSavedPoints(pointsByLevel as Record<string, {
        points?: number;
        maxPoints?: number;
        accuracy?: number;
        bestTime?: string;
        scenarios?: { scenarioId: string; accuracy: number }[];
      }>));
    }
  }, [addGameToStore, collaboration?.lastProgressSync, currentGame, dispatch, isReplayView, mode]);

  useEffect(() => {
    if (mode !== "game") return;
    if (!gameId || !currentGame?.id || currentGame.id !== gameId || levels.length === 0) return;
    if (collaboration?.roomId && collaboration.isConnected && !collaboration.codeSyncReady) return;

    const baseProgressData =
      typeof currentGame.progressData === "object" && currentGame.progressData !== null
        ? currentGame.progressData
        : {};

    const baseProgressWithoutLevels = sanitizeReplayProgressData(
      baseProgressData as Record<string, unknown>,
      isReplayView
    );

    const progressData: Record<string, unknown> = {
      ...baseProgressWithoutLevels,
      pointsByLevel: Object.fromEntries(
        Object.entries(points.levels).map(([name, data]) => [
          name,
          {
            points: data.points,
            maxPoints: data.maxPoints,
            accuracy: data.accuracy,
            bestTime: data.bestTime,
            scenarios: data.scenarios,
          },
        ])
      ),
    };
    const nextSnapshot = stableSerialize(progressData);
    const currentSnapshot = stableSerialize(baseProgressWithoutLevels);

    if (
      nextSnapshot === currentSnapshot ||
      nextSnapshot === lastSavedSnapshotRef.current ||
      nextSnapshot === inFlightSnapshotRef.current
    ) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      inFlightSnapshotRef.current = nextSnapshot;
      console.log("[ProgressPersistence] persisting progress", {
        gameId,
        isReplayView,
        keys: Object.keys(progressData),
        hasFinishedAt: "finishedAt" in progressData,
        hasFinalScore: "finalScore" in progressData,
      });

      const qs = new URLSearchParams();
      qs.set("accessContext", "game");
      const groupId = searchParams.get("groupId");
      const guestId = searchParams.get("guestId");
      const key = searchParams.get("key");
      if (groupId) qs.set("groupId", groupId);
      if (guestId) qs.set("guestId", guestId);
      if (key) qs.set("key", key);

      fetch(`${apiUrl(`/api/games/${gameId}/instance`)}?${qs.toString()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressData }),
      })
        .then((res) => {
          if (res.ok) return res.json();
          return null;
        })
        .then((data) => {
          lastSavedSnapshotRef.current = nextSnapshot;
          inFlightSnapshotRef.current = null;
          if (currentGame && data?.instance?.progressData) {
            addGameToStore({
              ...currentGame,
              progressData: data.instance.progressData,
            });
          }
          return data;
        })
        .catch(() => {
          inFlightSnapshotRef.current = null;
        });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [addGameToStore, collaboration, currentGame, gameId, isReplayView, levels.length, mode, points.levels, searchParams]);

  return null;
}
