import { Box, Button, Typography } from "@mui/material";
import { MapDetails } from "../../../types";

type AIEnablerProps = {
  updateHandler: (map: MapDetails) => void;
  selectedMap: MapDetails;
};

const AIEnabler = ({ updateHandler, selectedMap }: AIEnablerProps) => {
  const handleUpdate = () => {
    selectedMap.canUseAI = !selectedMap.canUseAI;
    console.log("selessctedMap", selectedMap);
    updateHandler(selectedMap);
  };

  console.log("selectedMap", selectedMap);
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        // center text vertically
      }}
    >
      <Typography id="edit-ai-title" variant="h3" component="h2">
        AI Enabled: {selectedMap.canUseAI ? "Yes" : "No"}
      </Typography>
      <Button color="info" onClick={handleUpdate}>
        Toggle AI
      </Button>
    </Box>
  );
};
export default AIEnabler;
