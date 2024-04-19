import { Box, Checkbox, FormControlLabel } from "@mui/material";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import {
  toggleShowHotkeys,
  toggleShowScenarioModel,
} from "./store/slices/levels.slice";

const ArtBoardControls = () => {
  const levels = useAppSelector((state) => state.levels);
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const dispatch = useAppDispatch();
  const showScenarioModel = levels[currentLevel - 1].showScenarioModel;
  const showHotkeys = levels[currentLevel - 1].showHotkeys;

  // add a mui checkbox for Hide/show Hotkeys and also a checkbox for Hide/show Model/Diff

  const handleHotkeys = () => {
    dispatch(toggleShowHotkeys(currentLevel));
  };

  const handleModelDiff = () => {
    dispatch(toggleShowScenarioModel(currentLevel));
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        color: "primary.main",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
      }}
    >
      <FormControlLabel
        control={<Checkbox checked={showHotkeys} onChange={handleHotkeys} />}
        color="primary"
        label="Hotkeys"
        sx={{
          userSelect: "none",
        }}
      />
      {/* <FormControlLabel
        control={
          <Checkbox checked={showScenarioModel} onChange={handleModelDiff} />
        }
        label="Model/Diff"
      /> */}
    </Box>
  );
};

export default ArtBoardControls;
