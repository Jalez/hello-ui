"use client";

import { useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";

type UserTelemetry = {
  userId: string;
  displayName?: string;
  email?: string;
  pasteCount?: number;
  largePasteCount?: number;
  focusLossCount?: number;
  activeEditMs?: number;
  editCount?: number;
  resetLevelCount?: number;
  resetGameCount?: number;
  levels?: Record<string, {
    pasteCount?: number;
    largePasteCount?: number;
    focusLossCount?: number;
    activeEditMs?: number;
    editCount?: number;
    resetCount?: number;
  }>;
};

function readGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("ui-designer-guest-id");
  } catch {
    return null;
  }
}

export function useGameplayTelemetry() {
  const { data: session } = useSession();
  const mode = useAppSelector((state) => state.options.mode);
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const addGameToStore = useGameStore((state) => state.addGameToStore);

  const actor = useMemo(() => {
    const guestId = !session?.user ? readGuestId() : null;
    return {
      userId: session?.user ? (session.userId || session.user.email || "") : (guestId || ""),
      email: session?.user?.email || (guestId ? `guest-${guestId}@local` : ""),
      displayName: session?.user?.name || (!session?.user && guestId ? "Guest" : undefined),
    };
  }, [session?.user, session?.userId]);

  const updateTelemetry = useCallback((mutate: (user: UserTelemetry) => UserTelemetry) => {
    if (mode !== "game" || !currentGame || !actor.userId) {
      return;
    }

    const progressData =
      currentGame.progressData && typeof currentGame.progressData === "object" && !Array.isArray(currentGame.progressData)
        ? currentGame.progressData
        : {};
    const telemetry =
      progressData.gameplayTelemetry && typeof progressData.gameplayTelemetry === "object" && !Array.isArray(progressData.gameplayTelemetry)
        ? progressData.gameplayTelemetry as { users?: Record<string, UserTelemetry>; updatedAt?: string }
        : {};
    const users = telemetry.users && typeof telemetry.users === "object" ? telemetry.users : {};
    const existingUser = users[actor.userId] ?? {
      userId: actor.userId,
      email: actor.email,
      displayName: actor.displayName,
      levels: {},
    };

    const nextUser = mutate({
      ...existingUser,
      userId: actor.userId,
      email: actor.email || existingUser.email,
      displayName: actor.displayName || existingUser.displayName,
      levels: existingUser.levels ?? {},
    });

    addGameToStore({
      ...currentGame,
      progressData: {
        ...progressData,
        gameplayTelemetry: {
          ...telemetry,
          users: {
            ...users,
            [actor.userId]: nextUser,
          },
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }, [actor.displayName, actor.email, actor.userId, addGameToStore, currentGame, mode]);

  const recordFocusLoss = useCallback((levelIndex?: number) => {
    updateTelemetry((user) => {
      const key = typeof levelIndex === "number" ? String(levelIndex) : null;
      return {
        ...user,
        focusLossCount: (user.focusLossCount ?? 0) + 1,
        levels: key
          ? {
              ...(user.levels ?? {}),
              [key]: {
                ...(user.levels?.[key] ?? {}),
                focusLossCount: (user.levels?.[key]?.focusLossCount ?? 0) + 1,
              },
            }
          : user.levels,
      };
    });
  }, [updateTelemetry]);

  const recordReset = useCallback((scope: "level" | "game", levelIndex?: number) => {
    updateTelemetry((user) => {
      const key = typeof levelIndex === "number" ? String(levelIndex) : null;
      return {
        ...user,
        resetLevelCount: scope === "level" ? (user.resetLevelCount ?? 0) + 1 : (user.resetLevelCount ?? 0),
        resetGameCount: scope === "game" ? (user.resetGameCount ?? 0) + 1 : (user.resetGameCount ?? 0),
        levels: key
          ? {
              ...(user.levels ?? {}),
              [key]: {
                ...(user.levels?.[key] ?? {}),
                resetCount: (user.levels?.[key]?.resetCount ?? 0) + 1,
              },
            }
          : user.levels,
      };
    });
  }, [updateTelemetry]);

  const recordPaste = useCallback((levelIndex: number, pastedLength: number) => {
    updateTelemetry((user) => {
      const key = String(levelIndex);
      const isLargePaste = pastedLength >= 80;
      return {
        ...user,
        pasteCount: (user.pasteCount ?? 0) + 1,
        largePasteCount: (user.largePasteCount ?? 0) + (isLargePaste ? 1 : 0),
        levels: {
          ...(user.levels ?? {}),
          [key]: {
            ...(user.levels?.[key] ?? {}),
            pasteCount: (user.levels?.[key]?.pasteCount ?? 0) + 1,
            largePasteCount: (user.levels?.[key]?.largePasteCount ?? 0) + (isLargePaste ? 1 : 0),
          },
        },
      };
    });
  }, [updateTelemetry]);

  const recordEditorActivity = useCallback((levelIndex: number, activeDeltaMs: number) => {
    updateTelemetry((user) => {
      const key = String(levelIndex);
      const boundedDelta = Math.max(0, Math.min(Math.round(activeDeltaMs), 5000));
      return {
        ...user,
        editCount: (user.editCount ?? 0) + 1,
        activeEditMs: (user.activeEditMs ?? 0) + boundedDelta,
        levels: {
          ...(user.levels ?? {}),
          [key]: {
            ...(user.levels?.[key] ?? {}),
            editCount: (user.levels?.[key]?.editCount ?? 0) + 1,
            activeEditMs: (user.levels?.[key]?.activeEditMs ?? 0) + boundedDelta,
          },
        },
      };
    });
  }, [updateTelemetry]);

  return {
    recordFocusLoss,
    recordReset,
    recordPaste,
    recordEditorActivity,
  };
}
