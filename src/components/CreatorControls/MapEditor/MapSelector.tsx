import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from "@mui/material";
import { MapDetails } from "../../../types";

type MapSelectorProps = {
  handleNameSelect: (mapName: string) => void;
  updateDetails: (map: MapDetails) => void;
  selectedMap: string;
  MapNames: string[];
};

const MapSelector = ({
  handleNameSelect,
  updateDetails,
  selectedMap,
  MapNames,
}: MapSelectorProps) => {
  const handleMapSelect = async (event: SelectChangeEvent<string>) => {
    const mapName = event.target.value;
    handleNameSelect(mapName);
    try {
      const response = await fetch(`http://localhost:3000/maps/${mapName}`);
      const data = await response.json();
      updateDetails(data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        margin: "1rem",
        padding: "1rem",
        border: "1px solid",
        borderColor: "secondary.main",
        borderRadius: "1rem",
        backgroundColor: "primary.dark",
      }}
    >
      <Typography id="edit-prompt-title" variant="h3" component="h2">
        Select a map:
      </Typography>

      <Typography id="edit-prompt-description" variant="body1" component="p">
        Select a map to edit or delete.
      </Typography>

      <FormControl
        fullWidth
        sx={{
          color: "primary.main",
          borderColor: "secondary.main",
        }}
      >
        <InputLabel
          id="map-names-label
        "
        >
          Map names
        </InputLabel>
        <Select
          labelId="map-names-label"
          label="Map names"
          value={selectedMap}
          onChange={handleMapSelect}
        >
          {MapNames.map((map, index) => (
            <MenuItem value={map} key={index}>
              {map}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default MapSelector;
