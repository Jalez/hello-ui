import { Box, IconButton } from "@mui/material";
import LevelSaver from "./LevelSaver";
import NewLevel from "./NewLevel";
import LevelRemover from "./LevelRemover";
import { useAppSelector } from "../../store/hooks/hooks";
import MagicButton from "./UniversalMagicButton";

const CreatorControls = () => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  if (!isCreator) return null;
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: "1rem",
        width: "100%",
        padding: "1rem",
      }}
    >
      <LevelRemover />
      <LevelSaver />
      <NewLevel />
      <MagicButton />
    </Box>
  );
};

export default CreatorControls;
