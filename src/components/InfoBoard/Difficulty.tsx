import { Box, Rating, Typography } from "@mui/material";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import { useState } from "react";
import { changeLevelDifficulty } from "../../store/slices/levels.slice";
//difficulty can eitehr be easy, medium, or hard

interface Difficulties {
  easy: number;
  medium: number;
  hard: number;
}

const difficulties: Difficulties = {
  easy: 1,
  medium: 2,
  hard: 3,
};
const Difficulty = () => {
  // get difficulty from level
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const difficulty = level.difficulty;
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [stars, setStars] = useState(difficulties[difficulty]);
  //   if difficulty is easy, value
  const handleChange = (value: number) => {
    // fidn the difficulty
    const difficulty = Object.keys(difficulties).find(
      (key) => difficulties[key as keyof Difficulties] === value
    ) as keyof Difficulties;
    dispatch(changeLevelDifficulty({ levelId: currentLevel, difficulty }));
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "1rem",
      }}
    >
      <Typography component="legend" color="primary">
        {
          // if the user is the creator, show the difficulty
          isCreator ? "Set" : ""
        }{" "}
        Difficulty:
      </Typography>
      <Rating
        name="customized-10"
        // make it so that the stars that are not there are still visible: Change outline color to opposite of primary
        sx={{
          "& .MuiRating-iconEmpty": {
            color: "primary.main",
          },
        }}
        value={stars}
        max={Object.keys(difficulties).length}
        disabled={!isCreator}
        onChange={(event, value) => {
          const newValue = value ?? difficulties[difficulty]; // fallback to the current difficulty value if null
          setStars(newValue);
          handleChange(newValue);
        }}
      />
    </Box>
  );
};

export default Difficulty;
