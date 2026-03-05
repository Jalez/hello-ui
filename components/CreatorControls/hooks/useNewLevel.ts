'use client';

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { initializePointsFromLevelsStateThunk } from "@/store/actions/score.actions";
import { addNewLevel, updateLevelIdentifier } from "@/store/slices/levels.slice";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { levelUrl } from "@/constants";
import { addLevelsToMap } from "@/lib/utils/network/maps";
import { useGameStore } from "@/components/default/games";

export const useNewLevel = () => {
  const dispatch = useAppDispatch();
  const levels = useAppSelector((state) => state.levels);
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const [isCreating, setIsCreating] = useState(false);

  const handleNewLevelCreation = async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      // Create on the backend first
      const response = await fetch(levelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "template",
          code: { html: "", css: "", js: "" },
          solution: { html: "", css: "", js: "" },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to create level (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          if (errorText) errorMessage += `: ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data.identifier) {
        throw new Error("Server did not return a level identifier");
      }

      // Backend confirmed — now add to Redux with the identifier
      dispatch(addNewLevel());
      const newLevelNumber = levels.length + 1; // 1-based
      dispatch(updateLevelIdentifier({ levelId: newLevelNumber, identifier: data.identifier }));
      dispatch(setCurrentLevel(newLevelNumber));
      dispatch(initializePointsFromLevelsStateThunk());

      // Add to map if we have a game context
      if (currentGame?.mapName) {
        await addLevelsToMap(currentGame.mapName, [data.identifier]);
      }
    } catch (error) {
      console.error("Error creating level:", error);
      alert(`Failed to create level: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsCreating(false);
    }
  };

  return { handleNewLevelCreation, isCreating };
};
