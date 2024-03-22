import { useCallback, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import Shaker from "../General/Shaker/Shaker";
import { InfoBoard } from "./InfoBoard";
import { InfoColors } from "./InfoColors";
// import { InfoPictures } from "./InfoPictures";
import { InfoSwitch } from "./InfoSwitch";
import { InfoText } from "./InfoText";
import { InfoTime } from "./InfoTime";
import { LevelData } from "./LevelData";
import { toggleShowModelSolution } from "../../store/slices/levels.slice";
import { Paper } from "@mui/material";

const Info = () => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state) => state.levels);
  const level = levels[currentLevel - 1];
  const showModel = level.showModelPicture;
  const handleSwitch = useCallback(() => {
    dispatch(toggleShowModelSolution(currentLevel));
  }, [currentLevel, dispatch]);

  if (!level) return <div>loading...</div>;
  return (
    <Paper
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        padding: "1rem",
        margin: "1rem 0",
        borderRadius: "2rem",
        // remove shadow
        zIndex: 10,
        boxShadow: 0,
        width: "100%",
        bgcolor: "secondary.main",
      }}
    >
      <InfoBoard>
        <InfoText>
          Points:{" "}
          <Shaker value={level.points}>
            <LevelData reduxState="points" /> /{" "}
            <LevelData reduxState="maxPoints" />
          </Shaker>
        </InfoText>
        <InfoText>
          Best Time:{" "}
          <Shaker value={level.timeData.pointAndTime[level.points]}>
            <InfoTime />
          </Shaker>
        </InfoText>
        <InfoText>
          Accuracy: <LevelData reduxState="accuracy" />%
        </InfoText>
        <InfoColors />
        {/* <InfoPictures /> */}
        <InfoSwitch
          rightLabel={"Show model"}
          leftLabel={"Show diff"}
          checked={showModel}
          switchHandler={handleSwitch}
        />
      </InfoBoard>
    </Paper>
  );
};

export default Info;
