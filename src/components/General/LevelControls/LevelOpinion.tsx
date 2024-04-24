import React, { useState } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import { styled } from "@mui/system";
import { useAppSelector } from "../../../store/hooks/hooks";

// Styled components for animation
const AnimatedThumbUpIcon = styled(ThumbUpIcon)(({ theme }) => ({
  transition: "transform 0.2s ease-in-out",
  "&:active": {
    transform: "scale(1.2)",
  },
}));

const AnimatedThumbDownIcon = styled(ThumbDownIcon)(({ theme }) => ({
  transition: "transform 0.2s ease-in-out",
  "&:active": {
    transform: "scale(1.2)",
  },
}));

const LevelOpinion = () => {
  const [opinion, setOpinion] = useState("");
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  const handleOpinionChange = (newOpinion: string) => {
    setOpinion(opinion === newOpinion ? "" : newOpinion); // Toggle opinion on click
  };
  if (isCreator) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Typography>Opinion on level:</Typography>
      <IconButton onClick={() => handleOpinionChange("up")}>
        <AnimatedThumbUpIcon
          sx={{
            color: opinion === "up" ? "green" : "black",
          }}
        />
      </IconButton>
      <IconButton onClick={() => handleOpinionChange("down")}>
        <AnimatedThumbDownIcon
          sx={{
            color: opinion === "down" ? "red" : "black",
          }}
        />
      </IconButton>
    </Box>
  );
};

export default LevelOpinion;
