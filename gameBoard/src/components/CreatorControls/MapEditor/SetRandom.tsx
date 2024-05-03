import { Box, Button, Input, Typography } from "@mui/material";
import { MapDetails } from "../../../types";
import { useEffect, useState } from "react";

type SetRandomProps = {
  selectedMap: MapDetails;
  updateHandler: (map: MapDetails) => void;
};

const SetRandom = ({ selectedMap, updateHandler }: SetRandomProps) => {
  const [currentRandom, setCurrentRandom] = useState(selectedMap.random);

  useEffect(() => {
    setCurrentRandom(selectedMap.random);
  }, [selectedMap.random]);

  const handlePartialUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentRandom(parseInt(event.target.value));
  };

  const handleUpdate = () => {
    selectedMap.random = currentRandom;
    updateHandler(selectedMap);
  };

  return (
    <Box
      sx={{
        width: "400px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          // center text vertically
        }}
      >
        <Typography id="edit-random" variant="h3" component="h2">
          Random:
        </Typography>
        <Input
          id="random"
          type="number"
          value={currentRandom}
          onChange={handlePartialUpdate}
        />
        <Button color="info" onClick={handleUpdate}>
          Update
        </Button>
      </Box>
      <Typography id="edit-prompt-title" variant="body1" component="p">
        This determines how many levels are randomly selected from the list of
        levels. If set to 0, all levels will be used.
      </Typography>
    </Box>
  );
};

export default SetRandom;
