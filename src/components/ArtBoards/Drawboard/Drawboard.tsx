/** @format */

import zIndex from "@mui/material/styles/zIndex";
import { useAppSelector } from "../../../store/hooks/hooks";
import { Image } from "../../General/Image/Image";

import { InfoBoard } from "../../InfoBoard/InfoBoard";
import { InfoText } from "../../InfoBoard/InfoText";
import { LevelData } from "../../InfoBoard/LevelData";
import ScreenshotWithRedux from "../../Specific/ScreenshotWithRedux/ScreenshotWithRedux";
import { ArtContainer } from "../ArtContainer";
import { Frame } from "../Frame";
import "./Drawboard.css";
import { SlideShower } from "./ImageContainer/SlideShower";
import { BoardTitle } from "../BoardTitle";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { InfoTime } from "../../InfoBoard/InfoTime";
import Shaker from "../../General/Shaker/Shaker";

export const Drawboard = (): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  if (!level) return <div>loading...</div>;
  console.log("DRAWBOARD LEVEL", level.id);
  console.log("html", level.code.html);

  return (
    <BoardContainer>
      <BoardTitle>Your version</BoardTitle>
      <Board>
        <InfoBoard>
          <InfoText>
            Points:{" "}
            <Shaker value={level.points}>
              <LevelData reduxState="points" /> /{" "}
              <LevelData reduxState="maxPoints" />
            </Shaker>
          </InfoText>
          <InfoText>
            Time:{" "}
            <Shaker value={level.timeData.pointAndTime[level.points]}>
              <InfoTime />
            </Shaker>
          </InfoText>
          <InfoText>
            <LevelData reduxState="accuracy" />%
          </InfoText>
        </InfoBoard>
        <ArtContainer>
          <SlideShower
            staticComponent={<Image imageUrl={level.image} name="solution" />}
            slidingComponent={
              <div
                style={{
                  height: "300px",
                  width: "400px",
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
                <div
                  style={{
                    position: "absolute",
                    // hide the screenshot
                    // visibility: "hidden",
                    bottom: 0,
                    // zIndex: 0,
                  }}
                >
                  <ScreenshotWithRedux
                    imageUrl={level.drawingUrl}
                    name="drawing"
                  >
                    <Image imageUrl={level.drawingUrl} name="drawing" />
                  </ScreenshotWithRedux>
                </div>
              </div>
            }
          />
        </ArtContainer>
      </Board>
    </BoardContainer>
  );
};
