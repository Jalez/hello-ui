import { styled } from "@mui/system";
import {
  setDarkMode,
  setShowWordCloud,
} from "../../../store/slices/options.slice";
import HelpModal from "../../Help/Help";
import { useAppDispatch, useAppSelector } from "../../../store/hooks/hooks";
import {
  Button,
  ButtonGroup,
  Fab,
  Fade,
  Paper,
  Popper,
  Typography,
} from "@mui/material";
import Brightness6Icon from "@mui/icons-material/Brightness6";
import LevelControls from "../../General/LevelControls/LevelControls";
import CloudIcon from "@mui/icons-material/Cloud";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import RestoreIcon from "@mui/icons-material/Restore";
import { setCurrentLevel } from "../../../store/slices/currentLevel.slice";
import { resetLevel } from "../../../store/slices/levels.slice";
import { useEffect, useRef, useState } from "react";

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
  const arrowRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);

  const levelChanger = (pickedLevel: any) => {
    dispatch(setCurrentLevel(pickedLevel));
  };

  const toggleWordCloud = () => {
    dispatch(setShowWordCloud(!options.showWordCloud));
  };

  const toggleDarkMode = () => {
    dispatch(setDarkMode(!options.darkMode));
  };

  const handleLevelReset = () => {
    dispatch(resetLevel(currentLevel));
  };

  const togglePopper = () => {
    setAnchorEl(arrowRef.current);
  };

  const handleAnchorElReset = () => {
    setAnchorEl(null);
  };

  return (
    <StyledContainer id="three-navs">
      <StyledNavContainer>
        <NavPopper
          anchorEl={anchorEl}
          paragraph="This is an irreversible action. Timer is nor affected. Are you sure you want to reset the level?"
          title="Reset Level"
          handleConfirmation={handleLevelReset}
          resetAnchorEl={handleAnchorElReset}
        />

        <StyledFab
          title="Reset Level"
          ref={arrowRef}
          color="secondary"
          onClick={togglePopper}
        >
          <RestoreIcon />
        </StyledFab>
        <HelpModal />
        <LevelControls
          currentlevel={currentLevel}
          levelHandler={levelChanger}
          maxLevels={Object.keys(levels).length}
          levelName={level.difficulty}
        />
        <StyledFab
          color="secondary"
          onClick={toggleDarkMode}
          title="Toggle Dark Mode"
        >
          <Brightness6Icon />
        </StyledFab>
        <StyledFab
          color="secondary"
          onClick={toggleWordCloud}
          title="Toggle Word Cloud"
        >
          {options.showWordCloud ? <CloudIcon /> : <CloudOffIcon />}
        </StyledFab>
      </StyledNavContainer>
    </StyledContainer>
  );
};

type NavPopperProps = {
  anchorEl: any;
  paragraph: string;
  title: string;
  handleConfirmation: () => void;
  resetAnchorEl?: () => void;
};

export const NavPopper = ({
  anchorEl,
  paragraph,
  title,
  handleConfirmation,
  resetAnchorEl,
}: NavPopperProps) => {
  const [openPopper, setOpenPopper] = useState(false);

  useEffect(() => {
    // whenever anchorEl changes, set openPopper to true
    if (anchorEl) {
      setOpenPopper(true);
    }
  }, [anchorEl]);

  useEffect(() => {
    // if openPopper is true, start a timer to close it after 5 seconds
    if (openPopper) {
      const timer = setTimeout(() => {
        setOpenPopper(false);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      resetAnchorEl && resetAnchorEl();
    }
  }, [openPopper]);

  const confirmationAndClose = () => {
    handleConfirmation();
    setOpenPopper(false);
  };
  return (
    <Popper
      // Note: The following zIndex style is specifically for documentation purposes and may not be necessary in your application.
      sx={{ zIndex: 1200 }}
      open={openPopper}
      anchorEl={anchorEl}
      placement={"bottom"}
      transition
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={350}>
          <Paper
            style={{
              // width: "20%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: "1em",
            }}
          >
            {/* add a header */}
            <Typography variant="h6">{title}</Typography>
            <Typography
              sx={{ p: 2, fontSize: "0.7rem" }}
              style={{
                width: "250px",
              }}
            >
              {paragraph}
            </Typography>
            <ButtonGroup variant="outlined" color="secondary">
              <Button
                onClick={confirmationAndClose}
                variant="outlined"
                color="secondary"
              >
                <Typography>Yes</Typography>
              </Button>
              <Button
                onClick={() => setOpenPopper(false)}
                variant="outlined"
                color="secondary"
              >
                <Typography>No</Typography>
              </Button>
            </ButtonGroup>
          </Paper>
        </Fade>
      )}
    </Popper>
  );
};
