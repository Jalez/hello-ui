/** @format */

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import {
  sendScoreToParentFrame,
  updatePointsThunk,
} from "./store/actions/score.actions";
import { updateAccuracy, updatePoints } from "./store/slices/levels.slice";
import { getPixelData } from "./utils/imageTools/getPixelData";
import calculateAccuracy from "./utils/imageTools/calculateAccuracy";

export const LevelUpdater = () => {
  //  Invisible component that updates the level in the store
  const dispatch = useAppDispatch();
  // get the points from the current level
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  // get the level from the levels array
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  // get the points from the current level

  const points = level ? level.points : 0;

  // evaluate the level whenever the data urls of the level images change
  useEffect(() => {
    if (!level) return;
    const scenarios = level.scenarios;
    // console.log("GETS HERE");
    for (const scenario of scenarios) {
      if (!scenario.drawingUrl || !scenario.solutionUrl) return;
      const { drawingUrl, solutionUrl, scenarioId } = scenario;
      const { width, height } = scenario.dimensions;
      const drawnImage = new Image();
      drawnImage;
      const solutionImage = new Image();

      drawnImage.src = drawingUrl;
      drawnImage.onload = imageLoaded;

      solutionImage.src = solutionUrl;
      solutionImage.onload = imageLoaded;

      // Wait for the image to load
      let imagesLoaded = 0;
      function imageLoaded() {
        imagesLoaded++;
        if (imagesLoaded == 2) {
          const drawingPixelData = getPixelData(drawnImage, width, height);
          const solutionPixelData = getPixelData(solutionImage, width, height);
          const { diff, accuracy } = calculateAccuracy(
            drawingPixelData,
            solutionPixelData
          );
          // console.log("accuracy", accuracy);
          dispatch(
            updateAccuracy({ currentLevel, scenarioId, diff, accuracy })
          );
        }
      }
    }
  }, [level?.scenarios]);

  useEffect(() => {
    dispatch(updatePoints({ currentLevel }));
  }, [level]);

  useEffect(() => {
    // dispatch(updatePointsThunk(points));
    dispatch(sendScoreToParentFrame());
  }, [points]);

  return <></>;
};
