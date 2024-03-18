/** @format */

import { createSlice } from "@reduxjs/toolkit";
import confetti from "canvas-confetti";
import { obfuscate } from "../../utils/obfuscators/obfuscate";
import Pixelmatch from "pixelmatch";
import { Buffer } from "buffer";
import { Level, levelNames } from "../../types";
import {
  createLevels,
  generatorNameAndFunction,
} from "../../utils/LevelCreator";
import { numberTimeToMinutesAndSeconds } from "../../utils/numberTimeToMinutesAndSeconds";
import {
  drawBoardWidth,
  drawBoardheight,
  gameMaxTime,
  mainColor,
  secondaryColor,
} from "../../constants";

const maxCodeLength = 100000;

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
        if (percentage > percentageTreshold) {
          if (
            percentage > percentageFullPointsTreshold &&
            !level.confettiSprinkled
          ) {
            confetti({ particleCount: 100 });
            level.confettiSprinkled = true;
          }
          const lastTenPercent = percentage - percentageTreshold;
          const remainingPercentage = 100 - percentageTreshold;
          const lastTenPercentPercentage = lastTenPercent / remainingPercentage;
          const points = Math.ceil(lastTenPercentPercentage * level.maxPoints);
          if (points < level.points) return;
          level.points = points;
          const currentTime = new Date().getTime();
          const timeAndDate = level.timeData.pointAndTime[points];
          if (!level.timeData.startTime) return;
          if (timeAndDate == "0:0" || !timeAndDate) {
            level.timeData.pointAndTime[points] = numberTimeToMinutesAndSeconds(
              currentTime - level.timeData.startTime
            );
          }
          level.completed = "yes";
        } else {
          level.points = 0;
        }

        storage.setItem(storage.key, JSON.stringify(state));
      };
      const { currentLevel, drawnImage, solutionImage } = action.payload;
      loadAndMatch(currentLevel, drawnImage, solutionImage);
    },
    updateWeek(state, action) {
      let week = action.payload;
      if (storage.getItem(storage.key)) {
        state = JSON.parse(storage.getItem(storage.key) || "[]");
      }
      // if levels have already been created, do nothing
      if (state.length > 0) {
        console.error("Levels have already been created!");
        return;
      }
      // otherwise, create the levels
      if (!week) week = "all";
      const levels = createLevels(week) as Level[];
      state = levels;
      storage.setItem(storage.key, JSON.stringify(state));
      return state;
    },
    resetLevel(state, action) {
      const level = state.find((level) => level.id === action.payload);
      if (!level) return;
      level.points = 0;
      level.completed = "no";
      level.accuracy = "";
      level.diff = "";
      level.confettiSprinkled = false;
      level.timeData.pointAndTime = {};
      const name = level.name.toString() as levelNames;
      const newGeneration = generatorNameAndFunction[name](
        mainColor,
        secondaryColor
      );
      level.code = { html: newGeneration.THTML, css: newGeneration.TCSS };
      level.solution = { html: newGeneration.SHTML, css: newGeneration.SCSS };
      level.instructions = newGeneration.instructions;
      level.question_and_answer = newGeneration.question_and_answer;
      level.solEvalUrl = "";
      level.drawnEvalUrl = "";
      level.drawingUrl = "";
      level.solutionUrl = "";

      // level.timeData.startTime = new Date().getTime();

      storage.setItem(storage.key, JSON.stringify(state));
    },
    startLevelTimer(state, action) {
      const level = state.find((level) => level.id === action.payload);
      if (!level) return;
      level.timeData.startTime = new Date().getTime();
      storage.setItem(storage.key, JSON.stringify(state));
    },

    updateCode(state, action) {
      const { id, code } = action.payload;
      const level = state.find((level) => level.id === id);

      if (!level) return;
      if (
        (code.html && code.html.length > maxCodeLength) ||
        (code.css && code.css.length > maxCodeLength)
      ) {
        console.error("Code is too long!");
        return;
      }

      if (
        level?.image &&
        (code.css.includes(level?.image) || code.html.includes(level?.image))
      ) {
        console.error("Note: Using the solutions own image url isn't allowed!");
        return;
      }

      if (code.html.includes("<script>")) {
        console.error("Using scripts isn't allowed!");
        return;
      }

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
  resetLevel,
  startLevelTimer,
} = levelsSlice.actions;

export default levelsSlice.reducer;
