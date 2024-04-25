import {
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { MapDetails } from "../../../types";

type LevelAdderProps = {
  updateHandler: (map: MapDetails) => void;
  selectedMap: MapDetails;
};

const LevelAdder = ({ updateHandler, selectedMap }: LevelAdderProps) => {
  const [levelNames, setLevelNames] = useState<string[]>([]);
  const [selectedLevelName, setSelectedLevelName] = useState("");

  useEffect(() => {
    // fetch maps from the server
    const fetchLevelNames = async () => {
      try {
        const response = await fetch("http://localhost:3000/levels/names");
        const data = await response.json();
        setLevelNames(data);
      } catch (error) {
        console.error("Error:", error);
      }
    };
    fetchLevelNames();
  }, []);

  const handleNameSelect = (event: SelectChangeEvent<string>) => {
    console.log("Selected level name:", event.target.value);
    setSelectedLevelName(event.target.value);
  };

  const addLevelNameToMap = async () => {
    selectedMap.levels.push(selectedLevelName);
    updateHandler(selectedMap);
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
      <Typography id="edit-prompt-title" variant="h3" component="h2">
        Add a level:
      </Typography>
      <Typography id="edit-prompt-description" variant="body1" component="p">
        Select a level to add to the map.
      </Typography>

      {/* Add a select */}
      <FormControl fullWidth>
        <Select value={selectedLevelName} onChange={handleNameSelect}>
          {levelNames.map((level, index) => (
            <MenuItem value={level} key={index}>
              {level}
            </MenuItem>
          ))}
        </Select>
        <Button color="info" onClick={addLevelNameToMap}>
          Add Level
        </Button>
      </FormControl>
    </Box>
  );
};

export default LevelAdder;
