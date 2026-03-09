"use client";

import { useEffect } from "react";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameplayTelemetry } from "./useGameplayTelemetry";

export function GameplayTelemetryTracker() {
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const { recordFocusLoss } = useGameplayTelemetry();

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        recordFocusLoss(currentLevel - 1);
      }
    };

    const handleBlur = () => {
      recordFocusLoss(currentLevel - 1);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [currentLevel, recordFocusLoss]);

  return null;
}
