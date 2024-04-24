/** @format */

import { createSlice } from "@reduxjs/toolkit";
import confetti from "canvas-confetti";
import { obfuscate } from "../../utils/obfuscators/obfuscate";
import { Level, difficulty, levelNames } from "../../types";
import {
  createLevels,
  generatorNameAndFunction,
} from "../../utils/LevelCreator";
import { numberTimeToMinutesAndSeconds } from "../../utils/numberTimeToMinutesAndSeconds";
import { gameMaxTime, mainColor, secondaryColor } from "../../constants";

type scenarioSolutionUrls = {
  [key: string]: string;
};
export const scenarioSolutionUrls: scenarioSolutionUrls = {};

const maxCodeLength = 100000;

let storage: ReturnType<typeof obfuscate> | null = null;

const levelTemplate1 = {
  question_and_answer: {
    question: "",
    answer: "",
  },
  week: "all",
  identifier: Math.random().toString(36).substring(7),
  instructions: [],
  events: [],
  help: {
    description: "",
    images: [],
    usefullCSSProperties: [],
  },
  difficulty: "easy" as difficulty,
  points: 0,
  maxPoints: 100,
  percentageTreshold: 90,
  percentageFullPointsTreshold: 98,
  accuracy: 0,
  interactive: false,
  showModelPicture: false,
  showHotkeys: false,
  showScenarioModel: false,
  lockHTML: false,
  lockCSS: false,
  lockJS: false,
  scenarios: [],
  timeData: {
    startTime: 0,
    pointAndTime: {},
  },
  confettiSprinkled: false,
  completed: "no",
};
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
        //console.error("Levels have already been created!");
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
      const newGeneration = generatorNameAndFunction[name]();
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
    updateSolutionCode(state, action) {
      const { id, code } = action.payload;
      const level = state[id - 1];
      if (!level) return;
      level.solution = code;
      storage?.setItem(storage.key, JSON.stringify(state));
    },

    updateCode(state, action) {
      const { id, code } = action.payload;
      const level = state[id - 1];

      if (!level) return;
      //console.log("updateCode");
      if (
        (code.html && code.html.length > maxCodeLength) ||
        (code.css && code.css.length > maxCodeLength) ||
        (code.js && code.js.length > maxCodeLength)
      ) {
        //console.error("Code is too long!");
        return;
      }

      // go through scenarios and make sure the solution url is not in the code
      for (const scenario of level.scenarios || []) {
        const scenarioUrl = scenarioSolutionUrls[scenario.scenarioId];
        if (
          scenarioUrl &&
          (code.css.includes(scenarioUrl) ||
            code.html.includes(scenarioUrl) ||
            code.js.includes(scenarioUrl))
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
      // //console.log("updateCode", code.html, code.css, code.js);
      // //console.log("level.code", code);
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
      if (urlName === "solutionUrl") {
        //console.log("STATE updateUrl solutionUrl");
        scenarioSolutionUrls[scenarioId] = dataURL;
        // Remove solution code from state if it exists
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
    changeLevelDifficulty(state, action) {
      console.log("Changing level difficulty");
      const { levelId, difficulty } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      console.log("difficulty", difficulty);
      level.difficulty = difficulty;
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    changeAccuracyTreshold(state, action) {
      const { levelId, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.percentageTreshold = Number(text);
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    changeMaxPoints(state, action) {
      const { levelId, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.maxPoints = Number(text);
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    changeScenarioDimensions(state, action) {
      const { levelId, scenarioId, dimensionType, value } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      const scenario = level.scenarios?.find(
        (scenario) => scenario.scenarioId === scenarioId
      );
      if (!scenario) return;
      console.log("changeScenarioDimensions", dimensionType, value);
      scenario.dimensions[dimensionType as "width" | "height"] = value;
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    removeSolutionCode(state, action) {
      const level = state[action.payload - 1];
      if (!level) return;
      level.solution.html = "";
      level.solution.css = "";
      level.solution.js = "";
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    addNewScenario(state, action: { payload: number }) {
      const level = state[action.payload - 1];
      if (!level) return;
      const newScenario = {
        scenarioId: Math.random().toString(36).substring(7),
        dimensions: {
          width: 300,
          height: 300,
        },
        accuracy: 0,
        js: "",
      };
      level.scenarios?.push(newScenario);
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    removeScenario(
      state,
      action: { payload: { levelId: number; scenarioId: string } }
    ) {
      const { levelId, scenarioId } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.scenarios = level.scenarios?.filter(
        (scenario) => scenario.scenarioId !== scenarioId
      );
      storage?.setItem(storage.key, JSON.stringify(state));
    },

    updateGuideSectionItem(state, action) {
      const { levelId, sectionIndex, itemIndex, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions[sectionIndex].content[itemIndex] = text;
      storage?.setItem(storage.key, JSON.stringify(state));
    },

    updateGuideSectionTitle(state, action) {
      const { levelId, sectionIndex, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions[sectionIndex].title = text;
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    removeGuideSection(state, action) {
      const { levelId, sectionIndex } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions.splice(sectionIndex, 1);
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    removeGuideSectionItem(state, action) {
      const { levelId, sectionIndex, itemIndex } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions[sectionIndex].content.splice(itemIndex, 1);
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    addGuideSection(state, action) {
      const { levelId, title, content } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.instructions.push({ title, content });
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    addGuideSectionItem(state, action) {
      const { levelId, sectionIndex, text } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      console.log("addGuideSectionItem", sectionIndex, text);
      level.instructions[sectionIndex].content.push(text);
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    handleLocking(state, action) {
      //get HTML, CSS or JS from the action, also levelId

      const { levelId, type } = action.payload;
      //Use type to determine which code to lock/unlock
      //Find the level from the state
      const level = state[levelId - 1];
      if (!level) return;
      //Change the lock state of the code
      if (type === "html") {
        level.lockHTML = !level.lockHTML;
      }
      if (type === "css") {
        level.lockCSS = !level.lockCSS;
      }
      if (type === "js") {
        level.lockJS = !level.lockJS;
      }
      //Save the state
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    updateLevelName(state, action) {
      const { levelId, name } = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      level.name = name;
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    addThisLevel(state, action) {
      const levelDetails = action.payload;
      const parsedLevelDetails = JSON.parse(levelDetails);
      state.push({ ...parsedLevelDetails, ...levelTemplate1 });
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    addNewLevel(state) {
      const newLevel: Level = {
        name: "template",
        code: {
          html: "",
          css: "",
          js: "",
        },
        solution: {
          html: "",
          css: "",
          js: "",
        },
        ...levelTemplate1,
      };
      state.push(newLevel);
      storage?.setItem(storage.key, JSON.stringify(state));
    },
    removeLevel(state, action) {
      const levelId = action.payload;
      const level = state[levelId - 1];
      if (!level) return;
      state.splice(levelId - 1, 1);

      storage?.setItem(storage.key, JSON.stringify(state));
    },
    updateLevelColors(state, action) {
      //receives an array of colors
      const { levelId, colors } = action.payload;
      console.log("updateLevelColors", colors);
      console.log("levelId", levelId);
      const level = state[levelId - 1];
      if (!level) return;
      if (level.buildingBlocks) {
        level.buildingBlocks.colors = colors;
      } else {
        level.buildingBlocks = { colors };
      }
    },
  },
});

export const {
  updateCode,
  updateSolutionCode,
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
  changeLevelDifficulty,
  changeAccuracyTreshold,
  changeScenarioDimensions,
  changeMaxPoints,
  addNewScenario,
  removeScenario,
  removeSolutionCode,
  updateGuideSectionItem,
  updateGuideSectionTitle,
  removeGuideSection,
  removeGuideSectionItem,
  addGuideSection,
  addGuideSectionItem,
  handleLocking,
  updateLevelName,
  addThisLevel,
  addNewLevel,
  removeLevel,
  updateLevelColors,
} = levelsSlice.actions;

export default levelsSlice.reducer;
