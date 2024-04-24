import { useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks/hooks";
import Shaker from "../General/Shaker/Shaker";
import { InfoBoard } from "./InfoBoard";
import { InfoColors } from "./InfoColors";

import { InfoText } from "./InfoText";
import { InfoTime } from "./InfoTime";
import { LevelData } from "./LevelData";

import { Box, Paper } from "@mui/material";
import Timer from "../../Timer";
import {
  changeAccuracyTreshold,
  changeMaxPoints,
} from "../../store/slices/levels.slice";
import Difficulty from "./Difficulty";

const Info = () => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const [edit, setEdit] = useState(false);
  const level = levels[currentLevel - 1];
  const showModel = level.showModelPicture;
  const interactive = level.interactive;
  const isCreator = options.creator;

  if (!level) return <div>loading...</div>;
  return (
    <Paper
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        padding: "0rem",
        margin: "0",
        borderRadius: "2rem",
        // remove shadow
        zIndex: 10,
        boxShadow: 0,
        width: "100%",
        bgcolor: "secondary.main",
      }}
    >
      <InfoBoard>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-around",
            alignItems: "center",
            width: "100%",
            padding: "1rem",
            flexWrap: "nowrap",
          }}
        >
          {!isCreator && <Timer />}
          <Difficulty />

          <Box>
            <InfoText>
              {isCreator ? "Max" : ""} Points:{" "}
              <Shaker value={level.points}>
                {!isCreator && (
                  <>
                    <LevelData reduxState="points" /> /{" "}
                  </>
                )}
                <LevelData
                  reduxState="maxPoints"
                  actionToDispatch={changeMaxPoints}
                />
              </Shaker>
            </InfoText>
            {!isCreator && (
              <InfoText>
                Best Time:{" "}
                <Shaker value={level.timeData.pointAndTime[level.points]}>
                  <InfoTime />
                </Shaker>
              </InfoText>
            )}
            {!isCreator && (
              <InfoText>
                Accuracy: <LevelData reduxState="accuracy" />%
              </InfoText>
            )}
            <InfoText>
              Accuracy threshold:{" "}
              <LevelData
                reduxState="percentageTreshold"
                actionToDispatch={changeAccuracyTreshold}
              />
              %
            </InfoText>
          </Box>

          <InfoColors />
        </Box>
        {/* <InfoPictures /> */}
      </InfoBoard>
    </Paper>
  );
};

export default Info;
