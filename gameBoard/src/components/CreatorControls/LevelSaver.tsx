//Add a material UI Button component that is used to save the current level and its changes to the backend server running on http://localhost:3000.

import { Box, Button, IconButton } from "@mui/material";
import { useAppSelector } from "../../store/hooks/hooks";
import PoppingTitle from "../General/PoppingTitle";
import { Save } from "@mui/icons-material";

const LevelSaver = () => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  const handleSave = () => {
    console.log("level", level);
    const name = level.name;
    fetch("http://localhost:3000/levels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [name]: level }),
    })
      .then((response) => {
        if (
          response.ok &&
          response.headers.get("content-type")?.includes("application/json")
        ) {
          return response.json();
        }
        throw new Error("Response not JSON or not OK.");
      })
      .then((data) => console.log(data))
      .catch((error) => console.error("Error:", error));
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
      <PoppingTitle topTitle="Save Level">
        <IconButton onClick={handleSave} color="primary">
          <Save />
        </IconButton>
      </PoppingTitle>
    </Box>
  );
};

export default LevelSaver;
