/** @format */

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
import { drawBoardWidth, drawBoardheight } from "../../../constants";
import { Box } from "@mui/material";

export const Drawboard = (): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  if (!level) return <div>loading...</div>;

  return (
    <BoardContainer>
      <BoardTitle>Your version</BoardTitle>
      <Board>
        <ArtContainer>
          <SlideShower
            staticComponent={<Image imageUrl={level.image} name="solution" />}
            slidingComponent={
              <Box
                style={{
                  height: drawBoardheight + "px",
                  width: drawBoardWidth + "px",
                  overflow: "hidden",
                }}
              >
                {/* <ErrorBoundary> */}
                <Frame
                  id="DrawBoard"
                  newCss={level.code.css}
                  newHtml={level.code.html}
                  name="drawingUrl"
                />
                {/* </ErrorBoundary> */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                  }}
                >
                  <ScreenshotWithRedux
                    imageUrl={level.drawingUrl}
                    // imageUrl="wdawdw"
                    name="drawing"
                  >
                    <Image imageUrl={level.drawingUrl} name="drawing" />
                  </ScreenshotWithRedux>
                </Box>
              </Box>
            }
          />
        </ArtContainer>
      </Board>
    </BoardContainer>
  );
};
