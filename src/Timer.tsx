// create a component that shows how much time user has currently spent on the level

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import { numberTimeToMinutesAndSeconds } from "./utils/numberTimeToMinutesAndSeconds";
import { Box, Paper, Typography } from "@mui/material";
import { resetLevel, startLevelTimer } from "./store/slices/levels.slice";

const Timer = () => {
  const dispatch = useAppDispatch();
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const level = levels[currentLevel - 1];
  const [timeSpent, setTimeSpent] = useState(numberTimeToMinutesAndSeconds(-1));
  const room = useAppSelector((state) => state.room);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const startTime = level.timeData.startTime;
    if (!startTime && room.currentRoom !== "Instruction") {
      dispatch(resetLevel(currentLevel));
      dispatch(startLevelTimer(currentLevel));
      return;
    } else if (startTime) {
      setTimeSpent(
        numberTimeToMinutesAndSeconds(new Date().getTime() - startTime)
      );

      interval = setInterval(() => {
        setTimeSpent(
          numberTimeToMinutesAndSeconds(new Date().getTime() - startTime)
        );
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [room, level]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        width: "100%",
        margin: "0",
        zIndex: 10,
      }}
    >
      <Paper
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          padding: "1rem",
          borderRadius: "2rem",
          // remove shadow
          boxShadow: 0,
          //   width: "100%",
          bgcolor: "secondary.main",
        }}
      >
        <Typography style={{ fontSize: "1.5rem" }} color="primary">
          Timer
        </Typography>
        <Typography style={{ fontSize: "1.5rem" }} color="primary">
          {" "}
          <strong>{timeSpent}</strong>
        </Typography>
      </Paper>
    </Box>
  );
};

export default Timer;
