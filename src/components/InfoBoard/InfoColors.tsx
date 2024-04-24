/** @format */

import { Box, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { InfoColor } from "./InfoColor";
import { useEffect } from "react";
import { dispatch } from "d3";
import { updateLevelColors } from "../../store/slices/levels.slice";

export const InfoColors = () => {
  const dispatch = useAppDispatch();
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  if (!level) return <div>loading...</div>;
  useEffect(() => {
    if (isCreator && level.solution) {
      //go through the level solution code and extract the colors, should be rgb or hex
      //store the colors in the level object

      const css = level.solution.css;
      const html = level.solution.html;
      const js = level.solution.js;
      const colors = css.match(
        /#[0-9a-f]{3,6}|rgb\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3}\)/g
      );
      //Make sure the list of colors only has unique values
      const uniqueColors = Array.from(new Set(colors));
      console.log("uniqueColors", uniqueColors);
      dispatch(
        updateLevelColors({ levelId: currentLevel, colors: uniqueColors })
      );
    }
  }, [level.solution]);

  console.log("COLORS:", level.buildingBlocks?.colors);
  console.log("LEVEL:", level);
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
