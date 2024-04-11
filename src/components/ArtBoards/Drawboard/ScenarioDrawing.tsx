import { useAppSelector } from "../../../store/hooks/hooks";
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

type ScenarioDrawingProps = {
  scenario: scenario;
};

export const ScenarioDrawing = ({
  scenario,
}: ScenarioDrawingProps): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  if (!level) return <div>loading...</div>;
  console.log("level.code", level.code);

  return (
    <BoardContainer width={scenario.dimensions.width}>
      {/* <BoardTitle>Your version</BoardTitle> */}
      <Board>
        <ArtContainer>
          <SlideShower
            sliderHeight={scenario.dimensions.height}
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
                }}
              >
                <Frame
                  id="DrawBoard"
                  newCss={level.code.css}
                  newHtml={level.code.html}
                  newJs={level.code.js}
                  scenario={scenario}
                  name="drawingUrl"
                />
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                  }}
                >
                  {/* <ScreenshotWithRedux
                    imageUrl={scenario.drawingUrl}
                    scenarioId={scenario.scenarioId}
                    name="drawing"
                  >
                    <Image
                      imageUrl={scenario.drawingUrl}
                      height={scenario.dimensions.height}
                      width={scenario.dimensions.width}
                    /> 
                  </ScreenshotWithRedux> */}
                </Box>
              </Box>
            }
          />
        </ArtContainer>
      </Board>
    </BoardContainer>
  );
};
