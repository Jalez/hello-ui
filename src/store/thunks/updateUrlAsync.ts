import { createAction, createAsyncThunk } from "@reduxjs/toolkit";
import loadImage from "../../utils/imageTools/loadBase64Image";
import { getPixelData } from "../../utils/imageTools/getPixelData";
import calculateAccuracy from "../../utils/imageTools/calculateAccuracy";
import { Level, scenario } from "../../types";
import { updateAccuracy } from "../slices/levels.slice";

// Define the structure of the action payload
interface UpdateUrlActionPayload {
  currentLevel: number;
  scenarioId: string;
}

export const updateUrlAsync = createAsyncThunk(
  "levels/updateUrlAsync",
  async (actionPayload: UpdateUrlActionPayload, { dispatch, getState }) => {
    const { currentLevel, scenarioId } = actionPayload;

    // Assuming your state structure is an array of Levels
    const state = getState() as { levels: Level[] };
    const level = state.levels[currentLevel - 1];

    // console.log("updateUrlAsync thunk");
    if (!level) return;

    const scenario = level.scenarios?.find(
      (s: scenario) => s.scenarioId === scenarioId
    );
    if (!scenario || !scenario.dimensions) return;

    const { width, height } = scenario.dimensions;
    if (!scenario.drawingUrl || !scenario.solutionUrl) return;

    // Load image data
    const drawnImage = new Image();
    const solutionImage = new Image();
    const loadDrawnImage = new Promise((resolve) => {
      drawnImage.onload = resolve;
      drawnImage.src = scenario.drawingUrl;
    });
    const loadSolutionImage = new Promise((resolve) => {
      solutionImage.onload = resolve;
      solutionImage.src = scenario.solutionUrl;
    });
    // console.log("loading images");
    await Promise.all([loadDrawnImage, loadSolutionImage]);

    // const drawingData = await loadImage(scenario.drawingUrl);
    // const solutionData = await loadImage(scenario.solutionUrl);
    const drawingPixelData = getPixelData(drawnImage, width, height);
    const solutionPixelData = getPixelData(solutionImage, width, height);

    // Calculate accuracy
    const { diff, accuracy } = calculateAccuracy(
      drawingPixelData,
      solutionPixelData
    );

    // console.log("accuracy", accuracy);

    // Dispatch an action to update the state
    dispatch(updateAccuracy({ currentLevel, scenarioId, diff, accuracy }));
  }
);
