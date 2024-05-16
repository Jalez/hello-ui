/** @format */
import "./ArtBoard.css";
import { ScenarioModel } from "./ModelBoard/ScenarioModel";
import { BoardsContainer } from "./BoardsContainer";
import { ScenarioDrawing } from "./Drawboard/ScenarioDrawing";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { Box, Typography } from "@mui/material";
import { KeyBindings } from "../Editors/KeyBindings";
import { addNewScenario } from "../../store/slices/levels.slice";
import ScenarioAdder from "./ScenarioAdder";
import ArtTabs from "./ArtTabs";
import DrawBoard from "./Drawboard/DrawBoard";
import ModelBoard from "./ModelBoard/ModelBoard";

const artBoardStyle = {
  width: "100%",
};

export const ArtBoards = (): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const showHotkeys = level.showHotkeys;

  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  const scenarios = level.scenarios;
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }

  return (
    <>
      <Box sx={artBoardStyle}>
        <BoardsContainer>
          <ArtTabs
            tabContents={[<ModelBoard />, <DrawBoard />]}
            tabNames={["Model solution", "Your design"]}
            startTab={0}
          />
          {/* <DrawBoard />
          <ModelBoard /> */}
          {showHotkeys && <KeyBindings />}
        </BoardsContainer>
      </Box>
    </>
  );
};
