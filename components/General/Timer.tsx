'use client';

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { numberTimeToMinutesAndSeconds } from "@/lib/utils/numberTimeToMinutesAndSeconds";
import { resetLevel, startLevelTimer } from "@/store/slices/levels.slice";
import PoppingTitle from "./PoppingTitle";
import { useGameplayTelemetry } from "./useGameplayTelemetry";

const Timer = () => {
  const dispatch = useAppDispatch();
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const level = levels[currentLevel - 1];
  const [timeSpent, setTimeSpent] = useState(numberTimeToMinutesAndSeconds(-1));
  const { recordReset } = useGameplayTelemetry();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const startTime = level.timeData.startTime;
    if (!startTime) {
      recordReset("level", currentLevel - 1);
      dispatch(resetLevel(currentLevel));
      dispatch(startLevelTimer(currentLevel));
      return;
    } else if (startTime) {
      interval = setInterval(() => {
        setTimeSpent(
          numberTimeToMinutesAndSeconds(new Date().getTime() - startTime)
        );
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [currentLevel, dispatch, level.timeData.startTime, recordReset]);

  return (
    <div
      className="flex justify-center items-center flex-col m-0 z-10"
    >
      <PoppingTitle topTitle="Time Spent">
        <strong className="text-primary">{timeSpent}</strong>
      </PoppingTitle>
    </div>
  );
};

export default Timer;
