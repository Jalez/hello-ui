/** @format */

import { scoreTypes } from "../constants/score.actions.js";
import { updatePoints } from "../slices/score.slice.js";
import { AppThunk } from "../store.js";

export const updateMaxPoints = (maxPoints = 0) => {
  return {
    type: scoreTypes.updateMaxPoints,
    payload: maxPoints,
  };
};

export const updatePointsThunk =
  (accuracy: number): AppThunk =>
  async (dispatch, getState) => {
    {
      const levels = getState().levels;
      const updatedPoints = levels.reduce((acc, level) => {
        acc += level.points;
        return acc;
      }, 0);

      dispatch(updatePoints(updatedPoints));
      dispatch(sendScoreToParentFrame());
    }
  };

export const sendScoreToParentFrame = (): AppThunk => (dispatch, getState) => {
  const levels = getState().levels;
  if (levels.length !== 0) {
    let points = 0;
    let maxPoints = 0;
    const week = levels[0].week;
    const bestTimes = {} as Record<string, [string, number]>;
    for (const level of levels) {
      const title = level.difficulty;
      maxPoints += level.maxPoints;
      const pointAndTime = level.timeData.pointAndTime;
      bestTimes[title] = ["0:0", 0];
      for (const points in pointAndTime) {
        const time = pointAndTime[points];
        if (time !== "0:0") {
          bestTimes[title] = [time, parseInt(points)];
        }
      }
    }
    for (const title in bestTimes) {
      points += bestTimes[title][1];
    }
    const bestTimesString = JSON.stringify(bestTimes);
    const data = points + ";" + maxPoints + ";" + week + ";" + bestTimesString;
    const encryptedData = btoa(data);
    window.parent.postMessage(
      {
        m: "s",
        d: encryptedData,
      },
      "*"
    );

    const levelsAndCode = {} as Record<string, {}>;
    // go through all levels and get the code
    for (const level of levels) {
      const title = level.difficulty;
      levelsAndCode[title] = {
        code: level.code,
        lockCSS: level.lockCSS,
        lockHTML: level.lockHTML,
        lockJS: level.lockJS,
      };
    }

    window.parent.postMessage(
      {
        m: "c",
        d: JSON.stringify(levelsAndCode),
      },
      "*"
    );
  }
};
