/** @format */

import { createSlice } from "@reduxjs/toolkit";
import confetti from "canvas-confetti";
import { obfuscate } from "../../utils/obfuscators/obfuscate";
import { Level, levelNames } from "../../types";
import {
  createLevels,
  generatorNameAndFunction,
} from "../../utils/LevelCreator";
import { numberTimeToMinutesAndSeconds } from "../../utils/numberTimeToMinutesAndSeconds";
import { gameMaxTime, mainColor, secondaryColor } from "../../constants";

const maxCodeLength = 100000;

let storage: ReturnType<typeof obfuscate> | null = null;

// let storage = obfuscate("ui-designer-layout-levels");
const timerStorage = obfuscate("ui-designer-start-time");

// Get initial state from local storage
let initialState: Level[] = [];
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

const levelsSlice = createSlice({
  name: "levels",
  initialState: [] as Level[],

  reducers: {
    evaluateLevel(state, action) {},
    updateWeek(state, action) {
      let week = action.payload;

      if (!week) week = "all";
      storage = obfuscate(`ui-designer-${week}`);
      if (storage.getItem(storage.key)) {
        state = JSON.parse(storage.getItem(storage.key) || "[]");
      }

      // if levels have already been created, do nothing
      if (state.length > 0) {
        console.error("Levels have already been created!");
        return state;
      }

      const levels = createLevels(week) as Level[];

      state = levels;
      storage.setItem(storage.key, JSON.stringify(state));
      return state;
    },
    resetLevel(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.identifier = Math.random().toString(36).substring(7);

      level.confettiSprinkled = false;
      level.timeData.pointAndTime = {};
      const name = level.name.toString() as levelNames;
      const newGeneration = generatorNameAndFunction[name](
        mainColor,
        secondaryColor,
        "#888"
      );
      level.code = {
        html: newGeneration.THTML,
        css: newGeneration.TCSS,
        js: newGeneration?.TJS || "",
      };
      level.solution = {
        html: newGeneration.SHTML,
        css: newGeneration.SCSS,
        js: newGeneration?.SJS || "",
      };
      level.instructions = newGeneration.instructions;
      level.question_and_answer = newGeneration.question_and_answer;

      level.scenarios?.forEach((scenario) => {
        scenario.accuracy = 0;
        scenario.differenceUrl = "";
        scenario.drawingUrl = "";
        scenario.solutionUrl = "";
      });

      // level.timeData.startTime = new Date().getTime();

      storage?.setItem(storage.key, JSON.stringify(state));
    },
    updateAccuracy(state, action) {
      const { currentLevel, scenarioId, diff, accuracy } = action.payload;
      const level = state[currentLevel - 1];
      if (!level) return;
      const scenario = level.scenarios?.find(
        (scenario) => scenario.scenarioId === scenarioId
      );
      if (!scenario) return;
      scenario.accuracy = accuracy;
      scenario.differenceUrl = diff;
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    updatePoints(state, action) {
      const { currentLevel } = action.payload;
      const level = state[currentLevel - 1];
      if (!level) return;
      // take the average of the accuracy of all scenarios
      const accuracy = level.scenarios.reduce(
        (acc, scenario) => acc + scenario.accuracy,
        0
      );
      const percentage = accuracy / level.scenarios.length;
      // round percentage to 2 decimal places
      const roundedPercentage = Math.round(percentage * 100) / 100;

      level.accuracy = roundedPercentage;
      let newpoints = 0;
      const percentageTreshold = level.percentageTreshold || 90;
      const percentageFullPointsTreshold =
        level.percentageFullPointsTreshold || 98;
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
        newpoints = Math.ceil(lastTenPercentPercentage * level.maxPoints);
        if (newpoints < level.points) return;
        level.points = newpoints;
        const currentTime = new Date().getTime();
        const timeAndDate = level.timeData.pointAndTime[newpoints];
        if (!level.timeData.startTime) return;
        if (timeAndDate == "0:0" || !timeAndDate) {
          level.timeData.pointAndTime[newpoints] =
            numberTimeToMinutesAndSeconds(
              currentTime - level.timeData.startTime
            );
        }
        level.completed = "yes";
      }
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    toggleShowModelSolution(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.showModelPicture = !level.showModelPicture;
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    startLevelTimer(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.timeData.startTime = new Date().getTime();
      storage?.setItem(storage.key, JSON.stringify(state));
    },

    updateCode(state, action) {
      const { id, code } = action.payload;
      const level = state[id - 1];

      if (!level) return;
      console.log("updateCode");
      if (
        (code.html && code.html.length > maxCodeLength) ||
        (code.css && code.css.length > maxCodeLength) ||
        (code.js && code.js.length > maxCodeLength)
      ) {
        console.error("Code is too long!");
        return;
      }

      // go through scenarios and make sure the solution url is not in the code
      for (const scenario of level.scenarios || []) {
        if (
          scenario.solutionUrl &&
          (code.css.includes(scenario.solutionUrl) ||
            code.html.includes(scenario.solutionUrl) ||
            code.js.includes(scenario.solutionUrl))
        ) {
          console.error(
            "Note: Using the solutions own image url isn't allowed!"
          );
          return;
        }
      }

      if (code.html.includes("<script>")) {
        console.error("Using scripts isn't allowed!");
        return;
      }
      // console.log("updateCode", code.html, code.css, code.js);
      // console.log("level.code", code);
      level.code = code;
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    updateUrl(state, action) {
      if (!action.payload) return;

      const { levelId, dataURL, urlName, scenarioId } = action.payload;
      // find the level and scenario
      const level = state[levelId - 1];
      if (!level) return;

      const scenario = level.scenarios?.find(
        (scenario) => scenario.scenarioId === scenarioId
      );
      if (!scenario) return;
      if (urlName === "drawingUrl") {
        // console.log("updateUrl drawingUrl");
        scenario.drawingUrl = dataURL;
      } else if (urlName === "solutionUrl") {
        // console.log("updateUrl solutionUrl");
        scenario.solutionUrl = dataURL;
        // Remove solution code from state if it exists
        if (level.solution.html) level.solution.html = "";
        if (level.solution.css) level.solution.css = "";
        if (level.solution.js) level.solution.js = "";
      }

      storage?.setItem(storage.key, JSON.stringify(state));
    },
    toggleImageInteractivity(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.interactive = !level.interactive;
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    toggleShowScenarioModel(state, action) {
      const { levelId, scenarioId } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.showScenarioModel = !level.showScenarioModel;
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    toggleShowHotkeys(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.showHotkeys = !level.showHotkeys;
      storage?.setItem(storage.key, JSON.stringify(state));
    },
  },
});

export const {
  updateCode,
  updateUrl,
  updatePoints,
  updateAccuracy,
  evaluateLevel,
  updateWeek,
  resetLevel,
  startLevelTimer,
  toggleShowModelSolution,
  toggleImageInteractivity,
  toggleShowScenarioModel,
  toggleShowHotkeys,
} = levelsSlice.actions;

export default levelsSlice.reducer;
