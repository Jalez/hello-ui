import MapIcon from "@mui/icons-material/Map";
import {
  Box,
  Button,
  IconButton,
  Modal,
  Paper,
  Typography,
} from "@mui/material";
import PoppingTitle from "../General/PoppingTitle";
import { useEffect, useState } from "react";
import { MapDetails } from "../../types";
import AIEnabler from "./MapEditor/AIEnabler";
import LevelAdder from "./MapEditor/LevelAdder";
import MapLevels from "./MapEditor/MapLevels";
import MapSelector from "./MapEditor/MapSelector";
import MapAdder from "./MapEditor/MapAdder";
import {
  getMapLevels,
  getMapNames,
  updateSelectedMap,
} from "../../utils/network/maps";
import SetRandom from "./MapEditor/SetRandom";

const MapEditor = () => {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [selectedMap, setSelectedMap] = useState("");
  const [MapNames, setMapNames] = useState<string[]>([]);
  const [selectedMapDetails, setSelectedMapDetails] = useState<MapDetails>({
    levels: [],
    canUseAI: false,
    random: 0,
  });
  useEffect(() => {
    // fetch maps from the server
    const fetchMapNames = async () => {
      setMapNames(await getMapNames());
    };
    fetchMapNames();
  }, []);

  useEffect(() => {
    const fetchMapLevels = async () => {
      if (selectedMap) {
        setSelectedMapDetails(await getMapLevels(selectedMap));
      }
    };
    fetchMapLevels();
  }, [selectedMap]);

  const updateSelectedMapDetails = async (newDetails: MapDetails) => {
    try {
      await updateSelectedMap(selectedMap, newDetails);
      setSelectedMapDetails({ ...newDetails });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleMapNameSelect = (newMapName: string) => {
    setSelectedMap(newMapName);
  };

  const handleMapDetailsSelect = (newMapDetails: MapDetails) => {
    setSelectedMapDetails(newMapDetails);
  };

  const updateMapNames = (newName: string) => {
    setMapNames([...MapNames, newName]);
  };

  return (
    <>
      <PoppingTitle topTitle="Maps">
        <IconButton color="warning" onClick={handleOpen}>
          <MapIcon />
        </IconButton>
      </PoppingTitle>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="edit-prompt-title"
        aria-describedby="edit-prompt-description"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Paper
          sx={{
            width: "80%",
            border: "2px solid #000",
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography id="edit-prompt-title" variant="h2" component="h2">
            Game Maps
          </Typography>
          <MapAdder updateMapNames={updateMapNames} />

          {MapNames.length !== 0 && (
            <MapSelector
              MapNames={MapNames}
              handleNameSelect={handleMapNameSelect}
              updateDetails={handleMapDetailsSelect}
              selectedMap={selectedMap}
            />
          )}
          {selectedMap && (
            <Paper
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                margin: "1rem",
                padding: "1rem",
                border: "1px solid",
                borderColor: "secondary.main",
                borderRadius: "1rem",
                backgroundColor: "primary.darker",
              }}
            >
              <Typography id="edit-prompt-title" variant="h3" component="h2">
                Selected Map: {selectedMap}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "top",
                  justifyContent: "space-around",
                  // center text vertically
                }}
              >
                <LevelAdder
                  updateHandler={updateSelectedMapDetails}
                  selectedMap={selectedMapDetails}
                />
                <MapLevels selectedMapDetails={selectedMapDetails} />

                {/* add a section for showing the canUseAI state and let it be changed there also */}
                <Box>
                  <AIEnabler
                    updateHandler={updateSelectedMapDetails}
                    selectedMap={selectedMapDetails}
                  />
                  <SetRandom
                    selectedMap={selectedMapDetails}
                    updateHandler={updateSelectedMapDetails}
                  />
                </Box>
              </Box>
            </Paper>
          )}
          <Button color="error" onClick={handleClose}>
            Close
          </Button>
        </Paper>
      </Modal>
    </>
  );
};

export default MapEditor;
