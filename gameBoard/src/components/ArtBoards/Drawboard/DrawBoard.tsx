import { Box, Typography } from "@mui/material";
import { BoardsContainer } from "../BoardsContainer";
import ScenarioAdder from "../ScenarioAdder";
import { ScenarioDrawing } from "./ScenarioDrawing";
import { useAppSelector } from "../../../store/hooks/hooks";

const DrawBoard = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const scenarios = level.scenarios;
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }
  return (
    <Box>
      <BoardsContainer>
        {scenarios.length === 0 ? (
          <Typography variant="h3" align="center" color="primary">
            No scenarios found. Add a new scenario to get started.
          </Typography>
        ) : (
          scenarios.map((scenario) => (
            <ScenarioDrawing key={scenario.scenarioId} scenario={scenario} />
          ))
        )}
        <ScenarioAdder />
      </BoardsContainer>
    </Box>
  );
};

export default DrawBoard;
