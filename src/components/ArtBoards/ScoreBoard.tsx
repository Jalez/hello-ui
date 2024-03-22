import { Paper } from "@mui/material";
import { Board } from "./Board";
import { BoardContainer } from "./BoardContainer";
import { BoardTitle } from "./BoardTitle";
import { useAppSelector } from "../../store/hooks/hooks";
import { Level } from "../../types";
import { InfoText } from "../InfoBoard/InfoText";
import { BoardsContainer } from "./BoardsContainer";
import { useTheme } from "@mui/material/styles";

const ScoreBoard = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector(
    (state) => state.levels[currentLevel - 1]
  ) as Level;
  const theme = useTheme();

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

  const paperStyle: React.CSSProperties = {
    backgroundColor: theme.palette.secondary.main, // use secondary color from theme
    padding: "1em",
    color: theme.palette.primary.main, // use primary color from theme
  };

  return (
    <BoardsContainer>
      <BoardContainer>
        <BoardTitle side="left">Points</BoardTitle>
        <Board>
          <Paper sx={paperStyle}>{timeData}</Paper>
        </Board>
        <BoardTitle side="right">Time</BoardTitle>
      </BoardContainer>
    </BoardsContainer>
  );
};

export default ScoreBoard;
