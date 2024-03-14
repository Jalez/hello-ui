import { Paper } from "@mui/material";
import { Board } from "./Board";
import { BoardContainer } from "./BoardContainer";
import { BoardTitle } from "./BoardTitle";
import { useAppSelector } from "../../store/hooks/hooks";
import { Level } from "../../types";
import { InfoText } from "../InfoBoard/InfoText";
import { BoardsContainer } from "./BoardsContainer";

const ScoreBoard = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector(
    (state) => state.levels[currentLevel - 1]
  ) as Level;

  const showTimeData = (level: Level) => {
    return Object.entries(level.timeData.pointAndTime).map(([key, value]) => {
      return (
        <InfoText key={key}>
          {key}: {value}
        </InfoText>
      );
    });
  };
  const timeData = showTimeData(level);

  return (
    <BoardsContainer>
      <BoardContainer>
        <BoardTitle side="left">Points</BoardTitle>
        <Board>
          <Paper
            sx={{
              backgroundColor: "#222",
              padding: "1em",
              //   margin: "1em",
              color: "white",
              //   height: "100%",
            }}
          >
            {timeData}
          </Paper>
        </Board>
        <BoardTitle side="right">Time</BoardTitle>
      </BoardContainer>
    </BoardsContainer>
  );
};

export default ScoreBoard;
