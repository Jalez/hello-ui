/** @format */

import { Diff } from "./Diff/Diff";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { ModelArtContainer } from "./ModelArtContainer";
import { useAppDispatch, useAppSelector } from "../../../store/hooks/hooks";
import { scenario } from "../../../types";
import { Image } from "../../General/Image/Image";
import { Box } from "@mui/material";
import { InfoSwitch } from "../../InfoBoard/InfoSwitch";
import { useCallback } from "react";
import {
  scenarioSolutionUrls,
  toggleShowModelSolution,
} from "../../../store/slices/levels.slice";

type ScenarioModelProps = {
  scenario: scenario;
};

export const ScenarioModel = ({
  scenario,
}: ScenarioModelProps): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const showModel = level.showModelPicture;
  const dispatch = useAppDispatch();
  const solutionUrls = useAppSelector((state: any) => state.solutionUrls);
  const solutionUrl = solutionUrls[scenario.scenarioId];

  const handleSwitchModel = useCallback(() => {
    dispatch(toggleShowModelSolution(currentLevel));
  }, [currentLevel, dispatch]);

  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
        margin: "2rem",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
          padding: "10px",
          top: "-20px",
          color: "secondary.main",
          bgcolor: "primary.main",
        }}
      >
        {scenario.dimensions.width + " px"}
      </Box>
      <Box
        sx={{
          position: "absolute",
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "10px",
          right: "-35px",
          top: "calc(50% - 30px)",
          transform: "translateY(-50%)",
          color: "secondary.main",
          bgcolor: "primary.main",
          writingMode: "vertical-lr",
          // for chrome
          WebkitWritingMode: "vertical-lr",
        }}
      >
        {scenario.dimensions.height + " px"}
      </Box>
      <BoardContainer width={scenario.dimensions.width}>
        <Board>
          <ModelArtContainer scenario={scenario}>
            {/* {!scenario.solutionUrl ? (
              <Frame
                id="DrawBoard"
                newCss={level.solution.css}
                newHtml={level.solution.html}
                newJs={level.solution.js}
                scenario={scenario}
                name="solutionUrl"
              />
            ) : */}
            {showModel && solutionUrl ? (
              <Image
                name="solution"
                imageUrl={solutionUrl}
                height={scenario.dimensions.height}
                width={scenario.dimensions.width}
              />
            ) : (
              <Diff scenario={scenario} />
            )}
          </ModelArtContainer>
          <Box
            sx={{
              bgcolor: "primary.main",
              color: "secondary.main",
              width: "100%",
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              flexDirection: "row",
            }}
          >
            <InfoSwitch
              rightLabel={"Show model"}
              leftLabel={"Show diff"}
              checked={showModel}
              switchHandler={handleSwitchModel}
            />
          </Box>
        </Board>
        {/* <BoardTitle side="right">Model version</BoardTitle> */}
      </BoardContainer>
    </Box>
  );
};
