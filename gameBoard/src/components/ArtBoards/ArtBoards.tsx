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

const artBoardStyle = {
  width: "100%",
};

export const ArtBoards = (): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const dispatch = useAppDispatch();
  const showHotkeys = level.showHotkeys;

  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  const scenarios = level.scenarios;
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }

  return (
    <Box sx={artBoardStyle}>
      {/* <ArtTabs
        tabContents={[
          <Typography variant="h2" align="center" color="primary">
            {!isCreator ? "Your solution" : `Level scenarios:`}
          </Typography>,
          <Typography variant="h2" align="center" color="primary">
            Model solution
          </Typography>,
        ]}
        tabNames={["Draw", "Model"]}
      /> */}
      <BoardsContainer>
        <Box>
          <Typography variant="h2" align="center" color="primary">
            {!isCreator ? "Your solution" : `Level scenarios:`}
          </Typography>
          <BoardsContainer>
            {scenarios.length === 0 ? (
              <Typography variant="h3" align="center" color="primary">
                No scenarios found. Add a new scenario to get started.
              </Typography>
            ) : (
              scenarios.map((scenario) => (
                <ScenarioDrawing
                  key={scenario.scenarioId}
                  scenario={scenario}
                />
              ))
            )}
            <ScenarioAdder />
          </BoardsContainer>
        </Box>
        {!isCreator && (
          <Box>
            <Typography variant="h2" align="center" color="primary">
              Model solution
            </Typography>
            <BoardsContainer>
              {scenarios.map((scenario) => (
                <ScenarioModel key={scenario.scenarioId} scenario={scenario} />
              ))}
            </BoardsContainer>
          </Box>
        )}
        {showHotkeys && <KeyBindings />}
      </BoardsContainer>
    </Box>
  );
};
