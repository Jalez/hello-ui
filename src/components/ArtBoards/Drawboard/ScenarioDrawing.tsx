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
import { Box, Button, Input } from "@mui/material";
import { scenario } from "../../../types";
import { InfoSwitch } from "../../InfoBoard/InfoSwitch";
import { useCallback, useEffect, useState } from "react";
import {
  changeScenarioDimensions,
  removeScenario,
  scenarioSolutionUrls,
  toggleImageInteractivity,
} from "../../../store/slices/levels.slice";
import InfoInput from "../../InfoBoard/InfoInput";

type ScenarioDrawingProps = {
  scenario: scenario;
};

export const ScenarioDrawing = ({
  scenario,
}: ScenarioDrawingProps): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const dispatch = useAppDispatch();
  const [editDimensions, setEditDimensions] = useState(false);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [dimensionWidth, setDimensionWidth] = useState(
    scenario.dimensions.width
  );
  const [dimensionHeight, setDimensionHeight] = useState(
    scenario.dimensions.height
  );
  const [drawWithSolution, setDrawWithSolution] = useState(
    isCreator ? true : false
  );
  const [css, setCss] = useState<string>(
    drawWithSolution ? level.solution.css : level.code.css
  );
  const [html, setHtml] = useState<string>(
    drawWithSolution ? level.solution.html : level.code.html
  );
  const [js, setJs] = useState<string>(
    drawWithSolution ? level.solution.js : level.code.js
  );

  if (!level) return <div>loading...</div>;
  // console.log("level.code", level.code);

  useEffect(() => {
    setCss(drawWithSolution ? level.solution.css : level.code.css);
    setHtml(drawWithSolution ? level.solution.html : level.code.html);
    setJs(drawWithSolution ? level.solution.js : level.code.js);
  }, [drawWithSolution, level.code, level.solution]);

  const handleSwitchDrawing = useCallback(() => {
    if (isCreator) {
      console.log("Switching drawing", drawWithSolution);
      setDrawWithSolution(!drawWithSolution);
    } else {
      dispatch(toggleImageInteractivity(currentLevel));
    }
  }, [currentLevel, dispatch, drawWithSolution, isCreator]);
  const solutionUrl = scenarioSolutionUrls[scenario.scenarioId];

  const handleStaticDimensionClick = () => {
    setEditDimensions(!editDimensions);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEditDimensions(false);
    handleDimensionChange("width", dimensionWidth);
    handleDimensionChange("height", dimensionHeight);
  };

  const handleDimensionLeave = () => {
    if (editDimensions) {
      setEditDimensions(false);
      handleDimensionChange("width", dimensionWidth);
      handleDimensionChange("height", dimensionHeight);
    }
  };

  const updateDimensionHeight = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensionHeight(+e.target.value);
  };

  const updateDimensionWidth = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensionWidth(+e.target.value);
  };

  const handleDimensionChange = (
    dimensionType: "width" | "height",
    value: number
  ) => {
    dispatch(
      changeScenarioDimensions({
        levelId: currentLevel,
        scenarioId: scenario.scenarioId,
        dimensionType,
        value,
      })
    );
  };
  const interactive = level.interactive;

  const handleRemoveScenario = () => {
    console.log("Removing scenario", scenario.scenarioId);
    dispatch(
      removeScenario({ levelId: currentLevel, scenarioId: scenario.scenarioId })
    );
  };
  console.log("scenario", scenario);
  return (
    <Box
      // add a listener for when the mouse is outside
      onMouseLeave={handleDimensionLeave}
      sx={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
        marginRight: "2rem",
        marginLeft: "2rem",
      }}
    >
      {isCreator && (
        <>
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
            {!editDimensions ? (
              <Box
                onClick={handleStaticDimensionClick}
                sx={{ cursor: "pointer", userSelect: "none" }}
              >
                {scenario.dimensions.width + " px"}
              </Box>
            ) : (
              <form onSubmit={handleSubmit}>
                <input
                  style={{
                    width: 80,
                    textAlign: "center",
                    backgroundColor: "#222",
                    fontSize: "1.2rem",
                    border: "none",
                    color: "white",
                    fontFamily: "Kontakt",
                    padding: 0,
                    margin: 0,
                    // remove onfocus border
                    outline: "none",
                  }}
                  type="number"
                  value={dimensionWidth}
                  onChange={updateDimensionWidth}
                />
                PX
              </form>
            )}
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
            {!editDimensions ? (
              <Box
                onClick={handleStaticDimensionClick}
                sx={{ cursor: "pointer", userSelect: "none" }}
              >
                {scenario.dimensions.height + " px"}
              </Box>
            ) : (
              <form>
                <input
                  color="primary"
                  style={{
                    height: 80, // Adjust width to handle vertical orientation
                    maxWidth: "100%", // Ensure it does not overflow
                    textAlign: "center", // Center text horizontally
                    backgroundColor: "#222",
                    fontSize: "1.2rem",
                    border: "none",
                    color: "white",
                    fontFamily: "Kontakt",
                  }}
                  type="number"
                  value={dimensionHeight}
                  onChange={updateDimensionHeight}
                />
                PX
              </form>
            )}
          </Box>
        </>
      )}

      <BoardContainer width={scenario.dimensions.width}>
        {/* <BoardTitle>Your version</BoardTitle> */}
        <Board>
          {" "}
          <ArtContainer>
            <SlideShower
              sliderHeight={scenario.dimensions.height}
              showStatic={!interactive && !isCreator}
              staticComponent={
                <Image
                  imageUrl={solutionUrl}
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
                    newCss={css}
                    newHtml={html}
                    newJs={js}
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
          <Box
            sx={{
              bgcolor: "primary.main",
              color: "secondary.main",
              width: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flexDirection: "column",
            }}
          >
            {isCreator ? (
              <>
                <Button onClick={handleRemoveScenario} color="error">
                  Remove Scenario
                </Button>
                <InfoSwitch
                  rightLabel={"Solution"}
                  leftLabel={"Template"}
                  checked={drawWithSolution}
                  switchHandler={handleSwitchDrawing}
                />
              </>
            ) : (
              <InfoSwitch
                rightLabel={"Interactive"}
                leftLabel={"Slider"}
                checked={interactive}
                switchHandler={handleSwitchDrawing}
              />
            )}
          </Box>
        </Board>
      </BoardContainer>
    </Box>
  );
};
