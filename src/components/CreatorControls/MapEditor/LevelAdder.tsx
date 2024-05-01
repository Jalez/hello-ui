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
import { LevelIdAndName, MapDetails } from "../../../types";
import { getLevelNames } from "../../../utils/network/levels";

type LevelAdderProps = {
  updateHandler: (map: MapDetails) => void;
  selectedMap: MapDetails;
};

const LevelAdder = ({ updateHandler, selectedMap }: LevelAdderProps) => {
  const [levelNames, setLevelNames] = useState<LevelIdAndName[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState("");

  useEffect(() => {
    // fetch maps from the server
    const fetchLevelNames = async () => {
      try {
        const levelNames = await getLevelNames();
        console.log("Level names:", levelNames[0]);
        setLevelNames(levelNames);
      } catch (error) {
        console.error("Error:", error);
      }
    };
    fetchLevelNames();
  }, []);

  const handleLevelIdSelect = (event: SelectChangeEvent<string>) => {
    console.log("Selected level name:", event.target.value);
    setSelectedLevelId(event.target.value);
  };

  const addLevelIdToMap = async () => {
    selectedMap.levels.push(selectedLevelId);
    updateHandler(selectedMap);
  };

  const createLevelNameOptions = (levelIdAndNameArray: LevelIdAndName[]) => {
    const options = [];

    //use for ... of loop to iterate over the levelIdAndName array
    for (const level in levelIdAndNameArray) {
      const levelObj = levelIdAndNameArray[level];
      //Each level is an object where is a single key (identifier) and its value (name)
      // take the value of the key and add it to the options array
      const name = Object.values(levelObj)[0];
      options.push(
        <MenuItem
          key={Object.keys(levelObj)[0]}
          value={Object.keys(levelObj)[0]}
        >
          {name}
        </MenuItem>
      );
    }

    return options;
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
        <Select value={selectedLevelId} onChange={handleLevelIdSelect}>
          {createLevelNameOptions(levelNames)}
        </Select>
        <Button color="info" onClick={addLevelIdToMap}>
          Add Level
        </Button>
      </FormControl>
    </Box>
  );
};

export default LevelAdder;
