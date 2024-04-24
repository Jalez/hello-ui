//Add a material UI Button component that is used to remove the current level and its changes to the backend server running on http://localhost:3000.

import { Box, Button } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { removeLevel } from "../../store/slices/levels.slice";
import { setCurrentLevel } from "../../store/slices/currentLevel.slice";

const LevelRemover = () => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const dispatch = useAppDispatch();
  const handleRemove = () => {
    //consider the number of levels
    if (levels.length === 1) {
      console.log("Cannot remove the last level at this time");
      return;
    }
    if (currentLevel === 1) {
      dispatch(removeLevel(currentLevel));
      return;
    }
    if (currentLevel === levels.length) {
      const oldLevel = currentLevel;
      dispatch(setCurrentLevel(currentLevel - 1));
      dispatch(removeLevel(oldLevel));
      return;
    }
    dispatch(removeLevel(currentLevel));
  };
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "1rem",
        width: "100%",
        padding: "1rem",
      }}
    >
      <Button variant="contained" onClick={handleRemove} color="error">
        Remove Level
      </Button>
    </Box>
  );
};

export default LevelRemover;
