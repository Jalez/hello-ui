/** @format */

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import { sendScoreToParentFrame } from "./store/actions/score.actions";
import { updateAccuracy, updatePoints } from "./store/slices/levels.slice";

import calculateAccuracy from "./utils/imageTools/calculateAccuracy";
import { addDifferenceUrl } from "./store/slices/differenceUrls.slice";

// drawingPixels, solutionPixels should be objects, where key is the scenarioId and value is the ImageData
type scenarioData = {
  [key: string]: ImageData;
};

export let scenarioDiffs = {};

export const LevelUpdater = () => {
  // each scenario has a drawing and a solution
  const [drawingPixels, setDrawingPixels] = useState<scenarioData>();
  const [solutionPixels, setSolutionPixels] = useState<scenarioData>();
  //  Invisible component that updates the level in the store
  const dispatch = useAppDispatch();
  // get the points from the current level
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  // get the level from the levels array
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  // get the points from the current level

  const points = level ? level.points : 0;
  useEffect(() => {
    //console.log("New level", currentLevel);
    // reset the pixels
    setDrawingPixels({});
    setSolutionPixels({});

    const handlePixelsFromIframe = (event: MessageEvent) => {
      if (event.data.message !== "pixels") return;
      // //console.log("HANDLE PIXELS FROM IFRAME", event.data);
      //console.log("urlname", event.data.urlName);
      if (event.data.urlName === "solutionUrl") {
        setSolutionPixels((prev) => ({
          ...prev,
          [event.data.scenarioId]: event.data.dataURL,
        }));
        return;
      } else if (event.data.urlName === "drawingUrl") {
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
    if (!drawingPixels || !solutionPixels) return;
    const scenarios = level?.scenarios;
    if (!scenarios) return;
    for (const scenario of scenarios) {
      //console.log("drawingPixels", drawingPixels);
      const { scenarioId } = scenario;
      if (!drawingPixels[scenarioId] || !solutionPixels[scenarioId]) return;
      const { diff, accuracy } = calculateAccuracy(
        drawingPixels[scenarioId],
        solutionPixels[scenarioId]
      );
      dispatch(updateAccuracy({ currentLevel, scenarioId, accuracy }));
      dispatch(addDifferenceUrl({ scenarioId, differenceUrl: diff }));
    }
  }, [drawingPixels, solutionPixels]);

  useEffect(() => {
    dispatch(updatePoints({ currentLevel }));
  }, [level]);

  useEffect(() => {
    // dispatch(updatePointsThunk(points));
    dispatch(sendScoreToParentFrame());
  }, [points]);

  return <></>;
};
