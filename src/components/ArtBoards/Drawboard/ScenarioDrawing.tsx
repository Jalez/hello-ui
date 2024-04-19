import { useAppDispatch, useAppSelector } from "../../../store/hooks/hooks";
import { Image } from "../../General/Image/Image";
import ScreenshotWithRedux from "../../Specific/ScreenshotWithRedux/ScreenshotWithRedux";
import { ArtContainer } from "../ArtContainer";
import { Frame } from "../Frame";
import "./Drawboard.css";
import { SlideShower } from "./ImageContainer/SlideShower";
import { BoardTitle } from "../BoardTitle";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { Box } from "@mui/material";
import { scenario } from "../../../types";
import { InfoSwitch } from "../../InfoBoard/InfoSwitch";
import { useCallback } from "react";
import { toggleImageInteractivity } from "../../../store/slices/levels.slice";

type ScenarioDrawingProps = {
  scenario: scenario;
};

export const ScenarioDrawing = ({
  scenario,
}: ScenarioDrawingProps): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const dispatch = useAppDispatch();
  if (!level) return <div>loading...</div>;
  // console.log("level.code", level.code);

  const handleSwitchDrawing = useCallback(() => {
    dispatch(toggleImageInteractivity(currentLevel));
  }, [currentLevel, dispatch]);

  const interactive = level.interactive;
  return (
    <BoardContainer width={scenario.dimensions.width}>
      {/* <BoardTitle>Your version</BoardTitle> */}
      <Board>
        {" "}
        <ArtContainer>
          <SlideShower
            sliderHeight={scenario.dimensions.height}
            showStatic={!interactive}
            staticComponent={
              <Image
                imageUrl={scenario.solutionUrl}
                height={scenario.dimensions.height}
                width={scenario.dimensions.width}
              />
            }
            slidingComponent={
              <Box
                style={{
                  height: scenario.dimensions.height + "px",
                  width: scenario.dimensions.width + "px",
                  overflow: "hidden",
                  position: "relative",
                  // disable user interaction
                  // pointerEvents: "none",
                }}
              >
                <Frame
                  id="DrawBoard"
                  events={level.events || []}
                  newCss={level.code.css}
                  newHtml={level.code.html}
                  newJs={level.code.js}
                  scenario={scenario}
                  name="drawingUrl"
                />
                {/* <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                  }}
                > */}
                {/* <Image
                    imageUrl={scenario.drawingUrl}
                    height={scenario.dimensions.height}
                    width={scenario.dimensions.width}
                  /> */}
                {/* <ScreenshotWithRedux
                    imageUrl={scenario.drawingUrl}
                    scenarioId={scenario.scenarioId}
                    name="drawing"
                  >
                  </ScreenshotWithRedux> */}
                {/* </Box> */}
              </Box>
            }
          />
        </ArtContainer>
        <InfoSwitch
          rightLabel={"Interactive"}
          leftLabel={"Slider"}
          checked={interactive}
          switchHandler={handleSwitchDrawing}
        />
      </Board>
    </BoardContainer>
  );
};
