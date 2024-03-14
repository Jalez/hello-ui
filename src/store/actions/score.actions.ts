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

// Create a thunk action creator that returns a function that accepts dispatch as an argument
export const updatePointsThunk =
  (accuracy: number): AppThunk =>
  async (dispatch, getState) => {
    {
      // Get current level from store
      const levels = getState().levels;
      // Loop through the levels and increment the points together as updatePoints
      const updatedPoints = levels.reduce((acc, level) => {
        // If the level is completed, add the points to the accumulator
        acc += level.points;
        return acc;
      }, 0);

      // Dispatch the thunk action
      dispatch(updatePoints(updatedPoints));
      dispatch(sendScoreToParentFrame());
    }
  };

export const sendScoreToParentFrame = (): AppThunk => (dispatch, getState) => {
  // Get score from store
  const score = getState().score;
  const levels = getState().levels;
  if (levels.length !== 0) {
    let points = 0;
    let maxPoints = 0;
    let time = 0;
    const week = levels[0].week;
    const bestTimes = {} as Record<string, [string, number]>;
    //   go through each level
    for (const level of levels) {
      const id = level.id;
      const title = level.difficulty;
      // add the max points to the accumulator
      maxPoints += level.maxPoints;
      // go through level time data pointAndTime and find the best points and its time
      const pointAndTime = level.timeData.pointAndTime;
      bestTimes[title] = ["0:0", 0];
      for (const points in pointAndTime) {
        const time = pointAndTime[points];
        if (time !== "0:0") {
          const stringifiedId = id.toString();
          bestTimes[title] = [time, parseInt(points)];
        }
      }
    }
    //   turn bestTimes into a string
    const bestTimesString = JSON.stringify(bestTimes);
    const data = points + ";" + maxPoints + ";" + week + ";" + bestTimesString;
    const encryptedData = btoa(data);
    // Send score to parent frame
    window.parent.postMessage(
      {
        m: "s",
        d: encryptedData,
      },
      "*"
    );
  }
};
