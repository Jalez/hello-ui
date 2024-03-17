// create a component that shows how much time user has currently spent on the level

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import { numberTimeToMinutesAndSeconds } from "./utils/numberTimeToMinutesAndSeconds";
import { Paper, Typography } from "@mui/material";
import { startLevelTimer } from "./store/slices/levels.slice";
import { NoEncryption } from "@mui/icons-material";
import { Box } from "@mui/system";

const Timer = () => {
  const dispatch = useAppDispatch();
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const level = levels[currentLevel - 1];
  const startTime = level.timeData.startTime;
  const [timeSpent, setTimeSpent] = useState(
    numberTimeToMinutesAndSeconds(new Date().getTime() - startTime)
  );

  useEffect(() => {
    const startTime = level.timeData.startTime;
    if (!startTime) {
      dispatch(startLevelTimer(currentLevel));
    }
    setTimeSpent(
      numberTimeToMinutesAndSeconds(new Date().getTime() - startTime)
    );

    const interval = setInterval(() => {
      setTimeSpent(
        numberTimeToMinutesAndSeconds(new Date().getTime() - startTime)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [level]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        width: "100%",
        margin: "1rem 0",
        zIndex: 10,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          padding: "1rem",
          borderRadius: "2rem",
          //   width: "100%",
          bgcolor: "secondary.main",
        }}
      >
        <Typography style={{ fontSize: "1.5rem" }} color="primary">
          {" "}
          <strong>Time: {timeSpent}</strong>
        </Typography>
      </Box>
    </div>
  );
};

export default Timer;
