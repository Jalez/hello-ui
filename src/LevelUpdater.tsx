/** @format */

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import { sendScoreToParentFrame } from "./store/actions/score.actions";
import { updateAccuracy, updatePoints } from "./store/slices/levels.slice";

import calculateAccuracy from "./utils/imageTools/calculateAccuracy";
import { addDifferenceUrl } from "./store/slices/differenceUrls.slice";
import { obfuscate } from "./utils/obfuscators/obfuscate";

// drawingPixels, solutionPixels should be objects, where key is the scenarioId and value is the ImageData
type scenarioData = {
  [key: string]: ImageData;
};

export let scenarioDiffs = {};

export const LevelUpdater = () => {
  // each scenario has a drawing and a solution
  const [drawingPixels, setDrawingPixels] = useState<scenarioData>();
  const [solutionPixels, setSolutionPixels] = useState<scenarioData>();
  const [compare, setCompare] = useState<boolean>(false);
  //  Invisible component that updates the level in the store
  const dispatch = useAppDispatch();
  // get the points from the current level
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const solutionUrls = useAppSelector((state) => state.solutionUrls);

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
        const newSolutionPixels = {
          ...solutionPixels,
          [event.data.scenarioId]: event.data.dataURL,
        };
        setSolutionPixels(newSolutionPixels);
        return;
      } else if (event.data.urlName === "drawingUrl") {
        setDrawingPixels({
          ...drawingPixels,
          [event.data.scenarioId]: event.data.dataURL,
        });
        setCompare(true);
      }
    };

    window.addEventListener("message", handlePixelsFromIframe);
    return () => {
      window.removeEventListener("message", handlePixelsFromIframe);
    };
  }, [currentLevel]);

  useEffect(() => {
    console.log("COMPARE", compare);
    if (!compare) return;
    console.log("drawingPixels", drawingPixels);
    console.log("solutionPixels", solutionPixels);
    if (!drawingPixels) return;
    if (!level) return;
    console.log("Level", level.scenarios[0].scenarioId);

    const scenarios = level?.scenarios;
    if (!scenarios) return;
    for (const scenario of scenarios) {
      const completeRest = () => {
        if (!solutionPixels) return;
        const { diff, accuracy } = calculateAccuracy(
          drawingPixels[scenarioId],
          solutionPixels[scenarioId]
        );
        dispatch(updateAccuracy({ currentLevel, scenarioId, accuracy }));
        dispatch(addDifferenceUrl({ scenarioId, differenceUrl: diff }));
        setCompare(false);
      };
      //console.log("drawingPixels", drawingPixels);
      const { scenarioId } = scenario;
      if (!drawingPixels[scenarioId]) return;

      if (!solutionPixels || !solutionPixels[scenarioId]) {
        // take the solutionUrl, and use that to create the solutionPixels
        const img = new Image();
        const solutionUrl = solutionUrls[scenarioId];

        img.src = solutionUrl;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = scenario.dimensions.width;
          canvas.height = scenario.dimensions.height;
          const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(
            0,
            0,
            scenario.dimensions.width,
            scenario.dimensions.height
          );
          setSolutionPixels({
            ...solutionPixels,
            [scenarioId]: imageData,
          });
        };
        return;
      } else {
        console.log("SOLUTION PIXEL FOUND ");
        completeRest();
      }
    }
  }, [drawingPixels, solutionPixels, compare]);

  useEffect(() => {
    dispatch(updatePoints({ currentLevel }));
  }, [level]);

  useEffect(() => {
    // dispatch(updatePointsThunk(points));
    dispatch(sendScoreToParentFrame());
  }, [points]);

  return <></>;
};
