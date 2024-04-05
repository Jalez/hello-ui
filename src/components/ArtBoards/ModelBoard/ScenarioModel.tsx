/** @format */

import { Diff } from "./Diff/Diff";
import { BoardContainer } from "../BoardContainer";
import { BoardTitle } from "../BoardTitle";
import { Board } from "../Board";
import { ModelArtContainer } from "./ModelArtContainer";
import { Model } from "./Model";
import { useAppSelector } from "../../../store/hooks/hooks";
import { scenario } from "../../../types";
import { Image } from "../../General/Image/Image";
import { Frame } from "../Frame";
import { Box } from "@mui/material";

type ScenarioModelProps = {
  scenario: scenario;
};

export const ScenarioModel = ({
  scenario,
}: ScenarioModelProps): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const showModel = level.showModelPicture;
  // console.log("scenario.dimensions.width", scenario.dimensions.width);
  // console.log("Scenario id in ScenarioModel", scenario.scenarioId);

  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
        marginRight: "2rem",
        marginLeft: "2rem",
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
          left: "-25px",
          top: "50%",
          transform: "translateY(-50%)",
          color: "secondary.main",
          bgcolor: "primary.main",
          writingMode: "sideways-lr",
        }}
      >
        {scenario.dimensions.height + " px"}
      </Box>
      <BoardContainer width={scenario.dimensions.width}>
        <Board>
          {/* <ModelInfoBoard showModel={showModel} setShowModel={setShowModel} /> */}
          <ModelArtContainer scenario={scenario}>
            {!scenario.solutionUrl ? (
              <Frame
                id="DrawBoard"
                newCss={level.solution.css}
                newHtml={level.solution.html}
                scenario={scenario}
                name="solutionUrl"
              />
            ) : showModel ? (
              <Image
                name="solution"
                imageUrl={scenario.solutionUrl}
                height={scenario.dimensions.height}
                width={scenario.dimensions.width}
              />
            ) : (
              <Diff scenario={scenario} />
            )}
          </ModelArtContainer>
        </Board>
        {/* <BoardTitle side="right">Model version</BoardTitle> */}
      </BoardContainer>
    </Box>
  );
};
