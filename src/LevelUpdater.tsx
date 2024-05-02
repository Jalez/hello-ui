/** @format */

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import { sendScoreToParentFrame } from "./store/actions/score.actions";

import { ScenarioUpdater } from "./ScenarioUpdater";

// drawingPixels, solutionPixels should be objects, where key is the scenarioId and value is the ImageData
type scenarioData = {
  [key: string]: ImageData;
};

export let scenarioDiffs = {};

export const LevelUpdater = () => {
  const [drawingPixels, setDrawingPixels] = useState<scenarioData>({});
  const [solutionPixels, setSolutionPixels] = useState<scenarioData>({});
  const points = useAppSelector((state) => state.points);
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);

  // get the level from the levels array
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  useEffect(() => {
    // reset the pixels

    const handlePixelsFromIframe = (event: MessageEvent) => {
      if (event.data.message !== "pixels") return;
      if (event.data.urlName === "solutionUrl") {
        const newSolutionPixels = {
          ...solutionPixels,
          [event.data.scenarioId]: event.data.dataURL,
        };
        //We need to use the prev value here because there are rapid updates to the state and we need to guarantee that the state is always using the latest value

        setSolutionPixels((prev) => ({
          ...prev,
          [event.data.scenarioId]: event.data.dataURL,
        }));
        return;
      } else if (event.data.urlName === "drawingUrl") {
        //We need to use the prev value here because there are rapid updates to the state and we need to guarantee that the state is always using the latest value
        setDrawingPixels((prev) => ({
          ...prev,
          [event.data.scenarioId]: event.data.dataURL,
        }));
      }
    };

    window.addEventListener("message", handlePixelsFromIframe);
    return () => {
      window.removeEventListener("message", handlePixelsFromIframe);
    };
  }, [currentLevel]);

  useEffect(() => {
    dispatch(sendScoreToParentFrame());
  }, [points.allPoints]);

  const handleSolutionPixelUpdate = (scenarioId: string, pixels: ImageData) => {
    setSolutionPixels({
      ...solutionPixels,
      [scenarioId]: pixels,
    });
  };

  const handleDrawingPixelUpdate = (scenarioId: string, pixels: ImageData) => {
    setDrawingPixels({
      ...drawingPixels,
      [scenarioId]: pixels,
    });
  };
  if (!level) return;
  const scenarios = level.scenarios;
  // get the points from the current level

  return (
    <>
      {scenarios.map((scenario) => {
        return (
          <ScenarioUpdater
            key={Math.random() * 1000 + scenario.scenarioId}
            scenario={scenario}
            drawingPixels={drawingPixels[scenario.scenarioId] || undefined}
            solutionPixels={solutionPixels[scenario.scenarioId] || undefined}
            handleSolutionPixelUpdate={handleSolutionPixelUpdate}
            handleDrawingPixelUpdate={handleDrawingPixelUpdate}
          />
        );
      })}
    </>
  );
};
