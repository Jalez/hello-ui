import { Box, Typography } from "@mui/material";
import { BoardsContainer } from "../BoardsContainer";
import { ScenarioModel } from "./ScenarioModel";
import { useAppSelector } from "../../../store/hooks/hooks";

const ModelBoard = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  const scenarios = level.scenarios;
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }
  if (isCreator) return null;

  return (
    <Box>
      <BoardsContainer>
        {scenarios.map((scenario) => (
          <ScenarioModel key={scenario.scenarioId} scenario={scenario} />
        ))}
      </BoardsContainer>
    </Box>
  );
};

export default ModelBoard;
