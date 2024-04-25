/** @format */

import "./App.css";

import { Editors } from "./components/Editors/Editors";
import { ArtBoards } from "./components/ArtBoards/ArtBoards";
import Instruction from "./components/Help/Instruction";
import { LevelUpdater } from "./LevelUpdater";
import { GameContainer } from "./GameContainer";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import InfoInstructions from "./components/InfoBoard/InfoInstructions";
import { CSSWordCloud } from "./components/CSSWordCloud/CSSWordCloud";
import { useEffect } from "react";
import { updateWeek } from "./store/slices/levels.slice";
import { sendScoreToParentFrame } from "./store/actions/score.actions";
import { Footer } from "./components/Footer/Footer";

import { Navbar } from "./components/Navbar/Navbar";
import ArtBoardControls from "./ArtBoardControls";
import { setCreator } from "./store/slices/options.slice";
import LevelSaver from "./components/CreatorControls/LevelSaver";
import CreatorControls from "./components/CreatorControls/CreatorControls";
import { Level } from "./types";
import { getMapLevels } from "./utils/network/maps";
import { getMapLevelsData } from "./utils/network/levels";
import Info from "./components/InfoBoard/Info";
import LevelOpinion from "./components/General/LevelControls/LevelOpinion";

const AppStyle = {
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  alignItems: "center",
  position: "relative" as const,
  width: "100%",
  height: "100%",
  // disable scrolling
  // overflow: "hidden",
  boxSizing: "border-box" as const,
};

export let allLevels: Level[] = [];

function App() {
  const levels = useAppSelector((state) => state.levels);
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  useEffect(() => {
    // once it's mounted, send a message to the parent window
    //Example url: http://localhost:5173/creator?week=test
    // look at the url params to determine the week
    const urlParams = new URLSearchParams(window.location.search);
    const map = urlParams.get("map");

    const fetchLevels = async (mapName: string) => {
      allLevels = await getMapLevelsData(mapName);
      console.log("allLevels", allLevels);
      dispatch(updateWeek({ levels: allLevels, mapName }));
    };
    fetchLevels(map || "all");

    // also check whether or not we are in the creator
    const isCreator = window.location.pathname.includes("creator");
    dispatch(setCreator(isCreator));

    dispatch(sendScoreToParentFrame());
  }, []);

  console.log("levels", levels);

  return (
    <>
      {!isCreator && <Instruction />}
      <article id="App" style={AppStyle}>
        <LevelUpdater />

        <GameContainer>
          {levels.length > 0 && (
            <>
              <LevelOpinion />

              <Navbar />
              <InfoInstructions>
                <Info />
              </InfoInstructions>
              {options.showWordCloud && <CSSWordCloud />}
              <ArtBoards />
              <ArtBoardControls />
              {isCreator && <Editors type="Solution" />}
              <Editors type="Template" />
            </>
          )}
          <Footer />
        </GameContainer>
      </article>
    </>
  );
}

export default App;
