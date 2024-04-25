/** @format */

// ModelArtContainer.tsx
import { Frame } from "../Frame";

import { ArtContainer } from "../ArtContainer";
import { useAppSelector } from "../../../store/hooks/hooks";
import { scenario } from "../../../types";
import { scenarioSolutionUrls } from "../../../store/slices/levels.slice";
import { generatorNameAndFunction } from "../../../utils/LevelCreator";
import { useEffect, useState } from "react";
import { allLevels } from "../../../App";

type ModelArtContainerProps = {
  children: JSX.Element;
  scenario: scenario;
};

type solutionObject = {
  [key: string]: {
    SCSS: string;
    SHTML: string;
    SJS: string;
  };
};

const namesAndSolutions: solutionObject = {};

export const ModelArtContainer = ({
  children,
  scenario,
}: ModelArtContainerProps): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const [solutionCSS, setSolutionCSS] = useState<solutionObject>({});
  const [solutionHTML, setSolutionHTML] = useState<solutionObject>({});
  const [solutionJS, setSolutionJS] = useState<solutionObject>({});
  if (namesAndSolutions[scenario.scenarioId] === undefined) {
    const originalLevel = allLevels.find(
      (defaultlevel) => defaultlevel.name === level.name
    );
    namesAndSolutions[scenario.scenarioId] = {
      SCSS: originalLevel?.solution.css || "",
      SHTML: originalLevel?.solution.html || "",
      SJS: originalLevel?.solution.js || "",
    };
  }

  const { SCSS, SHTML, SJS } = namesAndSolutions[scenario.scenarioId];

  // useEffect(() => {
  //   // set scss as level solution css
  //   setSolutionCSS((prev) => ({ ...prev, [level.name]: SCSS }));
  //   setSolutionHTML((prev) => ({ ...prev, [level.name]: SHTML }));
  //   setSolutionJS((prev) => ({ ...prev, [level.name]: SJS || "" }));
  // }, [currentLevel]);
  if (!level) return <div>loading...</div>;
  // console.log("scenario.solutionUrl", scenario.solutionUrl);
  // decode with base64
  const solutionUrl = scenarioSolutionUrls[scenario.scenarioId];
  return (
    <ArtContainer
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    >
      {!solutionUrl && SCSS && (
        <Frame
          id="DrawBoard"
          newCss={SCSS}
          newHtml={SHTML}
          newJs={SJS + "\n" + scenario.js}
          events={level.events || []}
          scenario={scenario}
          name="solutionUrl"
        />
      )}
      <div
        style={{
          position: "absolute",
          bottom: 0,
        }}
      >
        {children}
      </div>
    </ArtContainer>
  );
};
