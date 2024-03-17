import { styled } from "@mui/system";
import {
  setDarkMode,
  setShowWordCloud,
} from "../../../store/slices/options.slice";
import HelpModal from "../../Help/Help";
import { useAppDispatch, useAppSelector } from "../../../store/hooks/hooks";
import { Fab } from "@mui/material";
import Brightness6Icon from "@mui/icons-material/Brightness6";
import LevelControls from "../../General/LevelControls/LevelControls";
import { mainColor, secondaryColor } from "../../../constants";
import CloudIcon from "@mui/icons-material/Cloud";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import RestoreIcon from "@mui/icons-material/Restore";
import { setCurrentLevel } from "../../../store/slices/currentLevel.slice";

const StyledContainer = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  gap: "10px",
  alignItems: "center",
  flex: "1 0 100%",
  flexWrap: "wrap",
  height: "100%",
  margin: "0.2em",
  padding: "0.2em",
}));

const StyledNavContainer = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  width: "fit-content",
  backgroundColor: theme.palette.secondary.main,
  color: theme.palette.primary.main,
  padding: "0.5em",
  borderRadius: "2em",
}));

const StyledFab = styled(Fab)({
  boxShadow: "none",
  border: "none",
  backgroundColor: "transparent",
});

export const ThreeNavs = () => {
  const dispatch = useAppDispatch();
  const levels = useAppSelector((state) => state.levels);
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const options = useAppSelector((state) => state.options);
  const level = levels[currentLevel - 1];

  const levelChanger = (pickedLevel: any) => {
    dispatch(setCurrentLevel(pickedLevel));
  };

  const toggleWordCloud = () => {
    dispatch(setShowWordCloud(!options.showWordCloud));
  };

  const toggleDarkMode = () => {
    dispatch(setDarkMode(!options.darkMode));
  };

  return (
    <StyledContainer id="three-navs">
      <StyledNavContainer>
        <StyledFab color="secondary">
          <RestoreIcon />
        </StyledFab>
        <HelpModal />
        <LevelControls
          currentlevel={currentLevel}
          levelHandler={levelChanger}
          maxLevels={Object.keys(levels).length}
          levelName={level.difficulty}
        />
        <StyledFab color="secondary" onClick={toggleDarkMode}>
          <Brightness6Icon />
        </StyledFab>
        <StyledFab color="secondary" onClick={toggleWordCloud}>
          {options.showWordCloud ? <CloudIcon /> : <CloudOffIcon />}
        </StyledFab>
      </StyledNavContainer>
    </StyledContainer>
  );
};
