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
import PoppingTitle from "../General/PoppingTitle";
import InfoBox from "./InfoBox";

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
    <Box>
      <InfoBoard>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-around",
            alignItems: "center",
            width: "100%",
            flexWrap: "nowrap",
          }}
        >
          {!isCreator && (
            <InfoBox>
              <Timer />
            </InfoBox>
          )}

          <InfoText>
            <Shaker value={level.points}>
              <InfoBox>
                {!isCreator && (
                  <PoppingTitle topTitle={isCreator ? "Set Points" : "Points"}>
                    <LevelData reduxState="points" />/{" "}
                  </PoppingTitle>
                )}
                <PoppingTitle
                  topTitle={isCreator ? "Set Max Points" : "Max Points"}
                >
                  <LevelData
                    reduxState="maxPoints"
                    actionToDispatch={changeMaxPoints}
                  />
                </PoppingTitle>
              </InfoBox>
            </Shaker>
          </InfoText>
          {!isCreator && (
            <InfoBox>
              <PoppingTitle topTitle="Best Time">
                <InfoText>
                  <Shaker value={level.timeData.pointAndTime[level.points]}>
                    <InfoTime />
                  </Shaker>
                </InfoText>
              </PoppingTitle>
            </InfoBox>
          )}
          {!isCreator && (
            <InfoBox>
              <PoppingTitle topTitle="Accuracy">
                <InfoText>
                  <LevelData reduxState="accuracy" />%
                </InfoText>
              </PoppingTitle>
            </InfoBox>
          )}
          <InfoBox>
            <PoppingTitle topTitle="Accuracy Treshold">
              <InfoText>
                <LevelData
                  reduxState="percentageTreshold"
                  actionToDispatch={changeAccuracyTreshold}
                />
                %
              </InfoText>
            </PoppingTitle>
          </InfoBox>

          <InfoBox>
            <InfoColors />
          </InfoBox>
        </Box>
        {/* <InfoPictures /> */}
      </InfoBoard>
    </Box>
  );
};

export default Info;
