/** @format */

import { Box, Typography } from "@mui/material";
import { useAppSelector } from "../../store/hooks/hooks";
import { InfoColor } from "./InfoColor";

export const InfoColors = () => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  if (!level) return <div>loading...</div>;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Typography variant="h5">Colors</Typography>
      <Box
        sx={{
          display: "flex",
          // flexDirection: "column",
        }}
      >
        {level.buildingBlocks?.colors?.map((color) => (
          <InfoColor key={Math.random() * 10000} color={color} />
        ))}
      </Box>
      <Typography variant="body2">
        Click the color to copy color code
      </Typography>
    </Box>
  );
};
