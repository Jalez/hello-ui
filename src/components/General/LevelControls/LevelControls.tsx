/** @format */

import { IconButton, Typography } from "@mui/material";
import React from "react";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import { NavPopper } from "../../Navbar/ThreeNavs/ThreeNavs";
import { useAppSelector } from "../../../store/hooks/hooks";

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
  const [anchorEl, setAnchorEl] = React.useState(null);
  const levels = useAppSelector((state) => state.levels);
  const forwardArrowRef = React.useRef(null);

  const decreaseLevel = () => {
    levelHandler(currentlevel - 1);
  };

  const increaseLevelConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    // if the next level timer has not started, confirm
    const nextLevel = levels[currentlevel];
    if (nextLevel && !nextLevel.timeData.startTime) {
      setAnchorEl(forwardArrowRef.current);
      return;
    }
    increaseLevel();
  };
  const increaseLevel = () => {
    levelHandler(currentlevel + 1);
  };

  const resetAnchorEl = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <NavPopper
        anchorEl={anchorEl}
        paragraph="Are you sure you want to go to the next level? Timer for the next level will start immediately if you proceed."
        title="Next Level"
        handleConfirmation={increaseLevel}
        resetAnchorEl={resetAnchorEl}
      />
      <div
        style={{ display: "flex", justifyContent: "center" }}
        ref={forwardArrowRef}
      >
        <IconButton
          disabled={currentlevel === 1}
          style={{
            // hide it from sight if current level === 1
            visibility: currentlevel === 1 ? "hidden" : "visible",
          }}
          onClick={decreaseLevel}
        >
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
        <IconButton
          disabled={currentlevel === maxLevels}
          style={{
            // hide it from sight if current level === maxLevels
            visibility: currentlevel === maxLevels ? "hidden" : "visible",
          }}
          onClick={increaseLevelConfirm}
        >
          <ArrowForwardIosIcon color="primary" />
        </IconButton>
      </div>
    </>
  );
};

export default LevelControls;
