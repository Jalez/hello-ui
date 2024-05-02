/** @format */
import "./ArtBoard.css";
import { ScenarioModel } from "./ModelBoard/ScenarioModel";
import { BoardsContainer } from "./BoardsContainer";
import { ScenarioDrawing } from "./Drawboard/ScenarioDrawing";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { Box, Button, Paper, Typography } from "@mui/material";
import { KeyBindings } from "../Editors/KeyBindings";
import AddToPhotosIcon from "@mui/icons-material/AddToPhotos";
import { dispatch } from "d3";
import { addNewScenario } from "../../store/slices/levels.slice";

const artBoardStyle = {
  position: "relative" as const,
  width: "100%",
  overflow: "hidden",
};

export const ArtBoards = (): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const dispatch = useAppDispatch();
  const showScenarioModel = level.showScenarioModel;
  const showHotkeys = level.showHotkeys;

  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  const scenarios = level.scenarios;
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }

  const handleAddNewScenario = () => {
    dispatch(addNewScenario(currentLevel as number));
  };
  return (
    <div style={artBoardStyle}>
      <BoardsContainer>
        <div>
          <Typography variant="h2" align="center" color="primary">
            {!isCreator ? "Your solution" : `Level scenarios:`}
          </Typography>
          <BoardsContainer>
            {scenarios.length === 0 && (
              <Typography variant="h3" align="center" color="primary">
                No scenarios found. Add a new scenario to get started.
              </Typography>
            )}

            {scenarios.length > 0 &&
              scenarios.map((scenario) => (
                <Box key={scenario.scenarioId}>
                  <Typography variant="h3" align="center" color="primary">
                    {scenario.scenarioId}
                  </Typography>
                  <ScenarioDrawing
                    key={scenario.scenarioId}
                    scenario={scenario}
                  />
                </Box>
              ))}
            {isCreator && (
              <Button
                onClick={handleAddNewScenario}
                variant="text"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  width: "280px",
                  padding: 10,
                  margin: 4,
                }}
              >
                <AddToPhotosIcon sx={{ fontSize: 100 }} />
                <>Add a new scenario</>
              </Button>
            )}
          </BoardsContainer>
        </div>
        {!isCreator && (
          <div>
            <Typography variant="h2" align="center" color="primary">
              Model solution
            </Typography>
            <BoardsContainer>
              {scenarios.map((scenario) => (
                <ScenarioModel key={scenario.scenarioId} scenario={scenario} />
              ))}
            </BoardsContainer>
          </div>
        )}
        {/* )} */}
        {showHotkeys && <KeyBindings />}
      </BoardsContainer>
    </div>
  );
};
