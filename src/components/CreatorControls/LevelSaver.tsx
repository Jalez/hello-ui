//Add a material UI Button component that is used to save the current level and its changes to the backend server running on http://localhost:3000.

import { Box, Button } from "@mui/material";
import { useAppSelector } from "../../store/hooks/hooks";

const LevelSaver = () => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  const handleSave = () => {
    console.log("level", level);
    const name = level.name;
    fetch("http://localhost:3000/data", {
      method: "PUT",
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
        gap: "1rem",
        width: "100%",
        padding: "1rem",
      }}
    >
      <Button variant="contained" color="primary" onClick={handleSave}>
        Save Level
      </Button>
    </Box>
  );
};

export default LevelSaver;
