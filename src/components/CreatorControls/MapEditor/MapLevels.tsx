import { Box, Typography } from "@mui/material";
import { Level, MapDetails } from "../../../types";

type MapLevelsProps = {
  selectedMapDetails: MapDetails;
  levels: Level[];
};

const MapLevels = ({ selectedMapDetails, levels }: MapLevelsProps) => {
  return (
    <Box>
      <Typography id="edit-prompt-title" variant="h3" component="h2">
        Levels in this map:
      </Typography>
      <Typography component="ul">
        {levels.length > 0 &&
          levels.map((level) => (
            <Typography component="li" key={level.identifier}>
              {level.name}
            </Typography>
          ))}
      </Typography>

      {levels.length === 0 && (
        <Typography>No levels found in this map, add some.</Typography>
      )}
    </Box>
  );
};

export default MapLevels;
