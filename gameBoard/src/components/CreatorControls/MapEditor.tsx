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
import { Level, MapDetails } from "../../types";
import AIEnabler from "./MapEditor/AIEnabler";
import LevelAdder from "./MapEditor/LevelAdder";
import MapLevels from "./MapEditor/MapLevels";
import MapSelector from "./MapEditor/MapSelector";
import MapAdder from "./MapEditor/MapAdder";
import {
  getMapLevels,
  getMapNames,
  updateMap,
  // updateSelectedMap,
} from "../../utils/network/maps";
import SetRandom from "./MapEditor/SetRandom";

const MapEditor = () => {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [selectedMapName, setSelectedMapName] = useState("");
  const [MapNames, setMapNames] = useState<string[]>([]);
  const [selectedMapDetails, setSelectedMapDetails] = useState<MapDetails>({
    levels: [],
    canUseAI: false,
    random: 0,
  });
  const [mapLevels, setMapLevels] = useState<Level[]>([]);
  useEffect(() => {
    // fetch maps from the server
    const fetchMapNames = async () => {
      setMapNames(await getMapNames());
    };
    fetchMapNames();
  }, []);

  useEffect(() => {
    const fetchMapLevels = async () => {
      if (selectedMapName) {
        const levels = await getMapLevels(selectedMapName);
        console.log("levels", levels);
        // JATKETAAN TÄSTÄ, EN NYT JAKSA- T: PERJANTAI JAKKE
        setMapLevels(levels);
        // setSelectedMapDetails(await getMapLevels(selectedMap));
      }
    };
    fetchMapLevels();
  }, [selectedMapName]);

  const updateSelectedMapDetails = async (newDetails: MapDetails) => {
    try {
      const updatedMap = await updateMap(selectedMapName, newDetails);
      console.log("Updated map:", updatedMap);
      setSelectedMapDetails(updatedMap);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleMapNameSelect = (newMapName: string) => {
    setSelectedMapName(newMapName);
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
              selectedMap={selectedMapName}
            />
          )}
          {selectedMapName && (
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
                Selected Map: {selectedMapName}
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
                <MapLevels
                  selectedMapDetails={selectedMapDetails}
                  levels={mapLevels}
                />

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
