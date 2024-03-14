/** @format */

import { createSlice } from "@reduxjs/toolkit";
// import placeholder from '../../assets/Placeholder.svg';

const url = import.meta.env.LOCAL_TESTING_URL;

import confetti from "canvas-confetti";
import { obfuscate } from "../../utils/obfuscators/obfuscate";
import Pixelmatch from "pixelmatch";
import { Buffer } from "buffer";
import { Level } from "../../types";
import { createLevels } from "../../utils/LevelCreator";
import { numberTimeToMinutesAndSeconds } from "../../utils/numberTimeToMinutesAndSeconds";
import { drawBoardWidth, drawBoardheight, gameMaxTime } from "../../constants";

// Remove these static width and height values

const maxCodeLength = 100000;

// interface for initial state

const storage = obfuscate("ui-designer-layout-levels");
const timerStorage = obfuscate("ui-designer-start-time");

// Get initial state from local storage
let initialState: Level[] = JSON.parse(storage.getItem(storage.key) || "[]");
// get current time in milliseconds
const currentTime = new Date().getTime();
// get the time the user started the game
const lastUpdated = timerStorage.getItem(timerStorage.key);
if (lastUpdated && currentTime - parseInt(lastUpdated) > gameMaxTime) {
  initialState = [];
  timerStorage.setItem(timerStorage.key, currentTime.toString());
} else if (!lastUpdated) {
  timerStorage.setItem(timerStorage.key, currentTime.toString());
}

const parseStorage = (storage: any) => {
  const parsedStorage = JSON.parse(storage.getItem(storage.key) || "[]");
  return parsedStorage;
};

const levelsSlice = createSlice({
  name: "levels",
  initialState: parseStorage(storage) as Level[],

  reducers: {
    evaluateLevel(state, action) {
      const getPixelData = (img = new Image()) => {
        const canvas = document.createElement("canvas");
        // Set the width and height of the canvas to the width and height of the image
        canvas.width = img.width;
        canvas.height = img.height;
        // Get the 2D context of the canvas
        const ctx = canvas.getContext("2d");
        // Draw the image on the canvas
        ctx?.drawImage(img, 0, 0);
        // Get the image data from the canvas
        const imgData = ctx?.getImageData(
          0,
          0,
          drawBoardWidth,
          drawBoardheight
        );
        // Resolve the promise with the image data
        return imgData;
        // });
      };
      // get the image urls from the current level

      const loadAndMatch = (
        currentLevel: Number,
        drawnImage: HTMLImageElement,
        solutionImage: HTMLImageElement
      ) => {
        // set the src of the image to the data url
        const img1Data = getPixelData(drawnImage) as ImageData;
        const img2Data = getPixelData(solutionImage) as ImageData;

        // Create a diff image with the same dimensions as img1
        const diff = Buffer.alloc(img2Data.data.length as number) as Buffer;
        const width = img1Data?.width;
        const height = img1Data?.height;
        const accuracy = Pixelmatch(
          img2Data?.data,
          img1Data?.data,
          diff,
          width,
          height,
          {
            threshold: 0.1,
          }
        );
        // Update the current level with the accuracy and diff
        const level = state.find((level) => level.id === currentLevel);
        if (!level) return;
        const percentage = 100 - (accuracy / (width * height)) * 100;
        level.diff = diff.toString("base64");
        level.accuracy = percentage.toFixed(2);

        const percentageTreshold = 95;
        const percentageFullPointsTreshold = 99;
        // if percentage is over percentageFullPointsTreshold, use confetti
        if (percentage > percentageTreshold) {
          if (
            percentage > percentageFullPointsTreshold &&
            !level.confettiSprinkled
          ) {
            confetti({ particleCount: 100 });
            level.confettiSprinkled = true;
          }
          // Calculate the points based on the last 10 percent
          const lastTenPercent = percentage - percentageTreshold;
          const remainingPercentage = 100 - percentageTreshold;
          const lastTenPercentPercentage = lastTenPercent / remainingPercentage;
          const points = Math.ceil(lastTenPercentPercentage * level.maxPoints);
          if (points < level.points) return; // if points are less than the current points, do nothing
          level.points = points;
          // set the time for the level
          const currentTime = new Date().getTime();
          const timeAndDate = level.timeData.pointAndTime[points];
          if (timeAndDate == "0:0" || !timeAndDate) {
            // console.log("Setting time for points: ", points);
            level.timeData.pointAndTime[points] = numberTimeToMinutesAndSeconds(
              currentTime - level.timeData.startTime
            );
            // console.log("Current time for all points: ", level.timeData);
          }
          // set level completed to yes
          level.completed = "yes";
        }
        // If percentage is less than 90, set points to 0
        else {
          level.points = 0;
        }

        storage.setItem(storage.key, JSON.stringify(state));
      };
      // allImagesLoaded();
      const { currentLevel, drawnImage, solutionImage } = action.payload;
      loadAndMatch(currentLevel, drawnImage, solutionImage);
    },
    // update week (if there is no week in the state already)
    updateWeek(state, action) {
      const week = action.payload;
      if (storage.getItem(storage.key)) {
        state = JSON.parse(storage.getItem(storage.key) || "[]");
      }
      // if levels have already been created, do nothing
      if (state.length > 0) {
        console.log("Levels have already been created!");
        return;
      }
      // otherwise, create the levels
      const levels = createLevels(week) as Level[];
      state = levels;
      storage.setItem(storage.key, JSON.stringify(state));
      return state;
    },

    updateCode(state, action) {
      const { id, code } = action.payload;
      const level = state.find((level) => level.id === id);

      if (!level) return;
      if (
        (code.html && code.html.length > maxCodeLength) ||
        (code.css && code.css.length > maxCodeLength)
      ) {
        console.log("Code is too long!");
        return;
      }

      if (
        level?.image &&
        (code.css.includes(level?.image) || code.html.includes(level?.image))
      ) {
        console.log("Note: Using the solutions own image url isn't allowed!");
        return;
      }

      if (code.html.includes("<script>")) {
        console.log("Using scripts isn't allowed!");
        return;
      }

      console.log("UPDATING CODE FOR LEVEL", id);
      console.log("NEW CODE", code.html);
      level.code = code;
      storage.setItem(storage.key, JSON.stringify(state));
    },
    updateUrl(state, action) {
      if (!action.payload) return;

      const { id, dataURL, urlName } = action.payload;
      if (urlName === "drawingUrl") state[id - 1].drawingUrl = dataURL;
      else if (urlName === "solutionUrl") {
        state[id - 1].solutionUrl = dataURL;
        // set image
        state[id - 1].image = dataURL;
        // Remove solution code from state if it exists
        if (state[id - 1].solution.css) state[id - 1].solution.css = "";
        if (state[id - 1].solution.html) state[id - 1].solution.html = "";
        state[id - 1].timeData.startTime = new Date().getTime();
      }
      // update the code for the level in local storage
      storage.setItem(storage.key, JSON.stringify(state));
    },
    updateEvaluationUrl(state, action) {
      const { id, dataUrl, name } = action.payload;
      if (name === "drawing") state[id - 1].drawnEvalUrl = dataUrl;
      if (name === "solution") state[id - 1].solEvalUrl = dataUrl;

      // update the code for the level in local storage
      storage.setItem(storage.key, JSON.stringify(state));
    },
  },
});

export const {
  updateCode,
  updateUrl,
  updateEvaluationUrl,
  evaluateLevel,
  updateWeek,
} = levelsSlice.actions;

export default levelsSlice.reducer;
