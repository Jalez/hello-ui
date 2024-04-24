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
    const week = urlParams.get("week");
    // also check whether or not we are in the creator
    const isCreator = window.location.pathname.includes("creator");
    dispatch(setCreator(isCreator));

    dispatch(updateWeek(week));
    dispatch(sendScoreToParentFrame());
  }, []);

  return (
    <>
      {!isCreator && <Instruction />}
      <article id="App" style={AppStyle}>
        <LevelUpdater />

        <GameContainer>
          {levels.length > 0 && (
            <>
              <CreatorControls />

              <Navbar />
              <InfoInstructions />
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
