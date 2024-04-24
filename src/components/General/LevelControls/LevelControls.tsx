/** @format */

import {
  Box,
  FormControl,
  IconButton,
  Input,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from "@mui/material";
import React, { useEffect } from "react";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import { NavPopper } from "../../Navbar/Navbar";
import { useAppDispatch, useAppSelector } from "../../../store/hooks/hooks";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import LevelOpinion from "./LevelOpinion";
import { Edit } from "@mui/icons-material";
import { dispatch } from "d3";
import { updateLevelName } from "../../../store/slices/levels.slice";

interface LevelControlsProps {
  maxLevels: number;
  levelHandler: (level: number) => void;
  currentlevel: number;
  levelName?: string;
}

const LevelControls = ({
  maxLevels,
  levelHandler,
  currentlevel,
  levelName,
}: LevelControlsProps) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const levels = useAppSelector((state) => state.levels);
  const forwardArrowRef = React.useRef(null);
  const options = useAppSelector((state) => state.options);
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const isCreator = options.creator;
  const dispatch = useAppDispatch();
  const [name, setName] = React.useState(levelName || "Unnamed");

  // take each of the level names for the select

  const decreaseLevel = () => {
    levelHandler(currentlevel - 1);
  };

  useEffect(() => {
    setName(levelName || "Unnamed");
  }, [levelName, currentlevel]);

  const increaseLevelConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
    // if the next level timer has not started, confirm
    const nextLevel = levels[currentlevel];
    if (nextLevel && !nextLevel.timeData.startTime) {
      setAnchorEl(forwardArrowRef.current);
      return;
    }
    increaseLevel();
  };
  const increaseLevel = () => {
    levelHandler(currentlevel + 1);
  };

  const resetAnchorEl = () => {
    setAnchorEl(null);
  };

  const levelSelectHandler = (event: SelectChangeEvent) => {
    const levelIndex = levels.findIndex(
      (level) => level.name === event.target.value
    );
    levelHandler(levelIndex + 1);
  };

  const updateLevelNameHandler = (name: string) => {
    dispatch(updateLevelName({ levelId: currentlevel, name }));
  };

  const changeLevelName = (name: string) => {
    setName(name);
  };

  return (
    <>
      <NavPopper
        anchorEl={anchorEl}
        paragraph="Are you sure you want to go to the next level? Timer for the next level will start immediately if you proceed."
        title="Next Level"
        handleConfirmation={increaseLevel}
        resetAnchorEl={resetAnchorEl}
      />
      <Box
        sx={{ display: "flex", justifyContent: "center" }}
        ref={forwardArrowRef}
      >
        <IconButton
          disabled={currentlevel === 1}
          sx={{
            // hide it from sight if current level === 1
            visibility: currentlevel === 1 ? "hidden" : "visible",
          }}
          onClick={decreaseLevel}
        >
          <ArrowBackIosIcon color="primary" />
        </IconButton>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: "1.5rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <strong>
              Level {currentlevel} of {maxLevels}
            </strong>
            {/* {levelName && <>"The {levelName}"</>} */}
          </Typography>
          {(levels.length > 1 && (
            <LevelSelect
              options={levels}
              keyValue={"name"}
              handleSelect={levelSelectHandler}
              selectedOption={name || ""}
              handleNameUpdate={updateLevelNameHandler}
              handleNameChange={changeLevelName}
            />
          )) || (
            <Typography variant="h6" sx={{ color: "primary.main" }}>
              "The {name}"
            </Typography>
          )}
          <LevelOpinion />
        </Box>
        <IconButton
          disabled={currentlevel === maxLevels}
          sx={{
            // hide it from sight if current level === maxLevels
            visibility: currentlevel === maxLevels ? "hidden" : "visible",
          }}
          onClick={increaseLevelConfirm}
        >
          <ArrowForwardIosIcon color="primary" />
        </IconButton>
      </Box>
    </>
  );
};

type selectProps = {
  options: any[];
  keyValue: string;
  handleSelect: (event: SelectChangeEvent) => void;
  selectedOption: string;
  handleNameUpdate: (name: string) => void;
  handleNameChange: (name: string) => void;
};

const LevelSelect = ({
  options,
  keyValue,
  handleSelect,
  selectedOption,
  handleNameUpdate,
  handleNameChange,
}: selectProps) => {
  const [showEdit, setShowEdit] = React.useState(false);
  const [openEditor, setOpenEditor] = React.useState(false);
  const handleClickToEdit = () => {
    setOpenEditor(true);
  };

  const stateOptions = useAppSelector((state) => state.options);

  const isCreator = stateOptions.creator;
  return (
    <Box
      sx={{ minWidth: 120, color: "primary.main", bgColor: "primary.main" }}
      onMouseEnter={() => setShowEdit(true)}
      onMouseLeave={() => setShowEdit(false)}
    >
      {openEditor && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleNameUpdate(selectedOption);
            setOpenEditor(false);
          }}
        >
          <FormControl
            fullWidth
            sx={{
              display: "flex",
              flexDirection: "row",
            }}
          >
            <Input
              sx={{
                color: "primary.main",
                borderColor: "primary.main",
                bgColor: "primary.main",
              }}
              value={selectedOption}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => {
                handleNameUpdate(selectedOption);
                setOpenEditor(false);
              }}
            />
          </FormControl>
        </form>
      )}
      {!openEditor && (
        <FormControl
          fullWidth
          sx={{
            display: "flex",
            flexDirection: "row",
          }}
        >
          <Select
            onChange={handleSelect}
            value={selectedOption}
            variant="standard"
            sx={{
              color: "primary.main",
              borderColor: "primary.main",
              bgColor: "primary.main",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "primary.main", // Border color
                // border: "none",
              },
              "& .MuiSvgIcon-root": {
                color: "primary.main", // Dropdown icon color
              },
              "&:before": {
                // Underline color before click
                borderBottomColor: "secondary.main",
              },
              "&:after": {
                // Underline color after click
                borderBottomColor: "primary.main",
              },

              // take hover into account
              "&:hover:not(.Mui-disabled):before": {
                borderBottomColor: "secondary.main",
              },
            }}
          >
            {
              // map over the options
              options.map((option, index) => (
                <MenuItem value={option[keyValue]} key={Math.random() * index}>
                  The {option[keyValue]}
                </MenuItem>
              ))
            }
          </Select>
          {isCreator && (
            <IconButton
              color="primary"
              onClick={handleClickToEdit}
              sx={{
                //Keep in the dom but hide from view if not hovered
                visibility: showEdit ? "visible" : "hidden",
              }}
            >
              <Edit />
            </IconButton>
          )}
        </FormControl>
      )}
    </Box>
  );
};

export default LevelControls;
