/** @format */
import "./ArtBoard.css";
import { ScenarioModel } from "./ModelBoard/ScenarioModel";
import { BoardsContainer } from "./BoardsContainer";
import { ScenarioDrawing } from "./Drawboard/ScenarioDrawing";
import { useAppSelector } from "../../store/hooks/hooks";
import { Typography } from "@mui/material";

const artBoardStyle = {
  position: "relative" as const,
  width: "100%",
  overflow: "hidden",
};

export const ArtBoards = (): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  const scenarios = level.scenarios;
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }
  // console.log("SCENARIOS", scenarios);
  return (
    <div style={artBoardStyle}>
      {/* <ScoreBoard /> */}
      <BoardsContainer>
        {/* loop through  */}
        <div>
          <Typography variant="h2" align="center" color="primary">
            Your solution
          </Typography>
          <BoardsContainer>
            {scenarios.map((scenario) => (
              <ScenarioDrawing key={scenario.scenarioId} scenario={scenario} />
            ))}
          </BoardsContainer>
        </div>
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
      </BoardsContainer>
      {/* <CSSWordCloud /> */}
    </div>
  );
};
