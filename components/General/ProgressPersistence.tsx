"use client";

import { useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { apiUrl } from "@/lib/apiUrl";

const SAVE_DEBOUNCE_MS = 2000;

/**
 * When on a game route, persists progress (levels code + pointsByLevel) to the game instance
 * so that after refresh the user sees their best points per level and correct total.
 */
export function ProgressPersistence() {
  const params = useParams();
  const searchParams = useSearchParams();
  const levels = useAppSelector((state) => state.levels);
  const points = useAppSelector((state) => state.points);
  const currentGame = useGameStore((s) => s.getCurrentGame());
  const addGameToStore = useGameStore((s) => s.addGameToStore);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gameId = typeof params?.gameId === "string" ? params.gameId : Array.isArray(params?.gameId) ? params.gameId[0] : null;

  useEffect(() => {
    if (!gameId || !currentGame?.id || currentGame.id !== gameId || levels.length === 0) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      const progressData: Record<string, unknown> = {
        ...(typeof currentGame.progressData === "object" && currentGame.progressData !== null ? currentGame.progressData : {}),
        levels: levels.map((l) => ({ name: l.name, code: l.code })),
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
          if (data?.instance?.progressData) {
            addGameToStore({ ...currentGame, progressData: data.instance.progressData });
          }
        })
        .catch(() => {});
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [gameId, currentGame?.id, currentGame?.progressData, levels, points.levels, searchParams, addGameToStore]);

  return null;
}
