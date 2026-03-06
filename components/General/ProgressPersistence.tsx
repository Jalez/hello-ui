"use client";

import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { apiUrl } from "@/lib/apiUrl";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";

const SAVE_DEBOUNCE_MS = 2000;

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
  const params = useParams();
  const searchParams = useSearchParams();
  const levels = useAppSelector((state) => state.levels);
  const points = useAppSelector((state) => state.points);
  const mode = useAppSelector((state) => state.options.mode);
  const currentGame = useGameStore((s) => s.getCurrentGame());
  const collaboration = useOptionalCollaboration();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const inFlightSnapshotRef = useRef<string | null>(null);

  const gameId = typeof params?.gameId === "string" ? params.gameId : Array.isArray(params?.gameId) ? params.gameId[0] : null;

  useEffect(() => {
    lastSavedSnapshotRef.current = null;
    inFlightSnapshotRef.current = null;
  }, [gameId, currentGame?.id]);

  useEffect(() => {
    if (mode !== "game") return;
    if (!gameId || !currentGame?.id || currentGame.id !== gameId || levels.length === 0) return;
    if (collaboration?.roomId && collaboration.isConnected && !collaboration.codeSyncReady) return;

    const baseProgressData =
      typeof currentGame.progressData === "object" && currentGame.progressData !== null
        ? currentGame.progressData
        : {};

    const baseProgressWithoutLevels = Object.fromEntries(
      Object.entries(baseProgressData as Record<string, unknown>).filter(([key]) => key !== "levels")
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
  }, [collaboration?.codeSyncReady, collaboration?.isConnected, collaboration?.roomId, currentGame, gameId, levels.length, mode, points.levels, searchParams]);

  return null;
}
