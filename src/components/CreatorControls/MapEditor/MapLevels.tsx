import { Box, Typography } from "@mui/material";
import { MapDetails } from "../../../types";

type MapLevelsProps = {
  selectedMapDetails: MapDetails;
};

const MapLevels = ({ selectedMapDetails }: MapLevelsProps) => {
  return (
    <Box>
      <Typography id="edit-prompt-title" variant="h3" component="h2">
        Levels in this map:
      </Typography>
      <Typography component="ul">
        {selectedMapDetails.levels.length > 0 &&
          selectedMapDetails.levels.map((level) => (
            <Typography component="li" key={level}>
              {level}
            </Typography>
          ))}
      </Typography>

      {selectedMapDetails.levels.length === 0 && (
        <Typography>No levels found in this map, add some.</Typography>
      )}
    </Box>
  );
};

export default MapLevels;
