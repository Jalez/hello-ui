'use client';

import { useCallback } from "react";
import { useGameStore } from "@/components/default/games";
import { getMapLevels, removeLevelFromMap as removeLevelFromMapRequest } from "@/lib/utils/network/maps";
import { initializePointsFromLevelsStateThunk } from "@/store/actions/score.actions";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { addNotificationData } from "@/store/slices/notifications.slice";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { removeLevel, updateWeek, setAllLevels } from "@/store/slices/levels.slice";
import { resetSolutionUrls } from "@/store/slices/solutionUrls.slice";
import { setSolutions } from "@/store/slices/solutions.slice";
import { Level } from "@/types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const useLevelRemover = () => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const dispatch = useAppDispatch();
  const currentGame = useGameStore((state) => state.getCurrentGame());

  const refreshCurrentMapLevels = useCallback(async () => {
    if (!currentGame?.id || !currentGame.mapName) return;

    const freshLevels = await getMapLevels(currentGame.mapName);
    const solutions = freshLevels.reduce<Record<string, { html: string; css: string; js: string }>>(
      (acc, level: Level) => {
        acc[level.name] = {
          html: level.solution.html,
          css: level.solution.css,
          js: level.solution.js,
        };
        return acc;
      },
      {},
    );

    dispatch(
      updateWeek({
        levels: freshLevels,
        mapName: currentGame.mapName,
        gameId: currentGame.id,
        mode: options.mode,
        forceFresh: true,
      }),
    );
    dispatch(setSolutions(solutions));
    dispatch(resetSolutionUrls());
    setAllLevels(freshLevels);
    dispatch(initializePointsFromLevelsStateThunk());

    if (currentLevel > freshLevels.length) {
      dispatch(setCurrentLevel(Math.max(1, freshLevels.length)));
    }
  }, [currentGame?.id, currentGame?.mapName, currentLevel, dispatch, options.mode]);

  const handleRemove = useCallback(async () => {
    if (levels.length === 1) {
      dispatch(addNotificationData({ message: "Cannot remove the last level", type: "warning" }));
      return;
    }

    const levelToRemove = levels[currentLevel - 1];
    if (!levelToRemove) {
      return;
    }

    if (!levelToRemove.identifier || !UUID_REGEX.test(levelToRemove.identifier)) {
      if (currentLevel === levels.length) {
        dispatch(setCurrentLevel(Math.max(1, currentLevel - 1)));
      }
      dispatch(removeLevel(currentLevel));
      dispatch(addNotificationData({ message: "Unsaved level removed", type: "success" }));
      return;
    }

    if (!currentGame?.mapName) {
      dispatch(addNotificationData({ message: "Current game map is missing", type: "error" }));
      return;
    }

    try {
      await removeLevelFromMapRequest(currentGame.mapName, levelToRemove.identifier);
      await refreshCurrentMapLevels();
      dispatch(addNotificationData({ message: "Level removed from game", type: "success" }));
    } catch (error) {
      console.error("Failed to remove level from map", error);
      dispatch(addNotificationData({ message: "Failed to remove level", type: "error" }));
    }
  }, [levels, currentLevel, currentGame?.mapName, refreshCurrentMapLevels, dispatch]);

  return { handleRemove };
};
