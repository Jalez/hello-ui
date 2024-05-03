/** @format */

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import { sendScoreToParentFrame } from "./store/actions/score.actions";
import { updateAccuracy, updatePoints } from "./store/slices/levels.slice";

import calculateAccuracy from "./utils/imageTools/calculateAccuracy";
import { addDifferenceUrl } from "./store/slices/differenceUrls.slice";
import { scenario } from "./types";
import { getPixelData } from "./utils/imageTools/getPixelData";
import {
  refreshPoints,
  updateLevelAccuracy,
} from "./store/slices/points.slice";
import { addNotificationData } from "./store/slices/notifications.slice";

// drawingPixels, solutionPixels should be objects, where key is the scenarioId and value is the ImageData
type scenarioData = {
  [key: string]: ImageData;
};

export let scenarioDiffs = {};

type ScenarioUpdaterProps = {
  scenario: scenario;
  drawingPixels?: ImageData | undefined;
  solutionPixels?: ImageData | undefined;
  handleSolutionPixelUpdate: (scenarioId: string, pixels: ImageData) => void;
  handleDrawingPixelUpdate: (scenarioId: string, pixels: ImageData) => void;
};

export const ScenarioUpdater = ({
  scenario,
  drawingPixels,
  solutionPixels,
  handleSolutionPixelUpdate,
  handleDrawingPixelUpdate,
}: ScenarioUpdaterProps) => {
  const dispatch = useAppDispatch();
  const solutionUrls = useAppSelector((state) => state.solutionUrls);
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const scenarioId = scenario.scenarioId;

  useEffect(() => {
    const completeRest = () => {
      if (!solutionPixels) {
        return;
      }
      if (!drawingPixels) {
        return;
      }
      const { diff, accuracy } = calculateAccuracy(
        drawingPixels,
        solutionPixels
      );
      dispatch(
        updateLevelAccuracy({
          level: level,
          scenarioId: scenario.scenarioId,
          accuracy: accuracy,
        })
      );
      dispatch(refreshPoints());
      dispatch(addDifferenceUrl({ scenarioId, differenceUrl: diff }));
    };
    //console.log("drawingPixels", drawingPixels);
    const { scenarioId } = scenario;
    if (!drawingPixels) {
      return;
    }

    if (!solutionPixels) {
      // take the solutionUrl, and use that to create the solutionPixels
      const img = new Image();
      const solutionUrl = solutionUrls[scenarioId];
      // console.log("solutionUrl", solutionUrl, scenarioId);
      if (solutionUrl === undefined)
        console.log("solutionUrl is undefined", scenarioId);

      img.src = solutionUrl;
      img.onload = () => {
        const imageData = getPixelData(
          img,
          scenario.dimensions.width,
          scenario.dimensions.height
        );
        handleSolutionPixelUpdate(scenarioId, imageData);
      };
      // return;
    } else {
      completeRest();
    }
  }, [drawingPixels, solutionPixels, scenario]);

  return <></>;
};
