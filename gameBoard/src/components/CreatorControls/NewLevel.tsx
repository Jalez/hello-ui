//Add a material UI Button component that is used to save the current level and its changes to the backend server running on http://localhost:3000.

import { Box, Button, IconButton } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { addNewLevel } from "../../store/slices/levels.slice";
import PoppingTitle from "../General/PoppingTitle";
import { Add } from "@mui/icons-material";

const NewLevel = () => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const dispatch = useAppDispatch();

  const handleNewLevelCreation = () => {
    dispatch(addNewLevel());
  };
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <PoppingTitle topTitle="Create Level">
        <IconButton onClick={handleNewLevelCreation} color="success">
          <Add />
        </IconButton>
      </PoppingTitle>
    </Box>
  );
};

export default NewLevel;
