/** @format */

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import {
  updateLevelAccuracy,
  refreshPoints,
} from "./store/slices/points.slice";
import { addDifferenceUrl } from "./store/slices/differenceUrls.slice";
import { getPixelData } from "./utils/imageTools/getPixelData";
import { batch } from "react-redux";
import { scenario } from "./types";

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
    const solutionUrl = solutionUrls[scenario.scenarioId];
    if (!solutionUrl || solutionPixels) {
      return;
    }

    const img = new Image();
    img.src = solutionUrl;
    img.onload = () => {
      const imageData = getPixelData(
        img,
        scenario.dimensions.width,
        scenario.dimensions.height
      );
      handleSolutionPixelUpdate(scenario.scenarioId, imageData);
    };
  }, [solutionUrls, scenario, solutionPixels]);

  useEffect(() => {
    if (!drawingPixels || !solutionPixels) {
      return;
    }

    const worker = new Worker(
      new URL("./utils/workers/imageComparisonWorker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = ({ data }) => {
      const { accuracy, diff } = data;

      batch(() => {
        dispatch(
          updateLevelAccuracy({
            level: level,
            scenarioId: scenarioId,
            accuracy: accuracy,
          })
        );
        dispatch(refreshPoints());
        dispatch(
          addDifferenceUrl({
            scenarioId: scenarioId,
            differenceUrl: diff,
          })
        );
      });
      worker.terminate();
    };

    worker.onerror = (error) => {
      console.error("Worker error:", error.message);
      worker.terminate();
    };

    // Copy buffers before transferring
    const drawingBuffer = drawingPixels.data.buffer.slice(0);
    const solutionBuffer = solutionPixels.data.buffer.slice(0);

    worker.postMessage(
      {
        drawingBuffer: drawingBuffer,
        solutionBuffer: solutionBuffer,
        width: drawingPixels.width,
        height: drawingPixels.height,
      },
      [drawingBuffer, solutionBuffer]
    );

    return () => worker.terminate(); // Cleanup the worker on unmount or dependency change
  }, [drawingPixels, solutionPixels, level, dispatch, scenarioId]);

  return <></>;
};
