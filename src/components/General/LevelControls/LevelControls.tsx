/** @format */

import { Box, IconButton, Typography } from "@mui/material";
import React from "react";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";

interface LevelControlsProps {
  maxLevels: number;
  levelHandler: (level: number) => void;
  currentlevel: number;
  levelName?: string;
}

const LevelControls = ({
  maxLevels,
  levelHandler,
  currentlevel,
  levelName,
}: LevelControlsProps) => {
  const decreaseLevel = () => {
    levelHandler(currentlevel - 1);
  };

  const increaseLevel = () => {
    levelHandler(currentlevel + 1);
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <IconButton disabled={currentlevel === 1} onClick={decreaseLevel}>
        <ArrowBackIosIcon color="primary" />
      </IconButton>
      <Typography
        style={{
          fontSize: "1.5rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <strong>
          Level {currentlevel} of {maxLevels}
        </strong>
        {levelName && <>"The {levelName}"</>}
      </Typography>
      <IconButton disabled={currentlevel === maxLevels} onClick={increaseLevel}>
        <ArrowForwardIosIcon color="primary" />
      </IconButton>
    </Box>
  );
};

export default LevelControls;
