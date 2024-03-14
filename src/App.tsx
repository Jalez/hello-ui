/** @format */

import "./App.css";

import { Navbar } from "./components/Navbar/Navbar";
import { Editors } from "./components/Editors/Editors";
import { ArtBoards } from "./components/ArtBoards/ArtBoards";
import Instruction from "./components/Help/Instruction";
import { LevelUpdater } from "./LevelUpdater";
import { GameContainer } from "./GameContainer";
import { InfoBoard } from "./components/InfoBoard/InfoBoard";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import InfoInstructions from "./components/InfoBoard/InfoInstructions";
import { InfoQuestionAndAnswer } from "./components/InfoBoard/InfoQuestionAndAnswer";
import { CSSWordCloud } from "./components/CSSWordCloud/CSSWordCloud";
import { useEffect } from "react";
import { updateWeek } from "./store/slices/levels.slice";

const AppStyle = {
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  alignItems: "center",
  position: "relative" as const,
  width: "100%",
  height: "100vh",
  border: "10px solid black",
  // give it a shadow
  // backgroundColor: "yellow",
  // maxHeight: "100vh",
};

function App() {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const dispatch = useAppDispatch();

  useEffect(() => {
    // once it's mounted, send a message to the parent window
    // look at the url params to determine the week
    const urlParams = new URLSearchParams(window.location.search);
    const week = urlParams.get("week");
    dispatch(updateWeek(week));
  }, []);

  return (
    <article id="App" style={AppStyle}>
      <LevelUpdater />
      <Instruction />
      <GameContainer>
        {levels.length > 0 && (
          <>
            <Navbar />

            <InfoBoard>
              <InfoInstructions />
              <InfoQuestionAndAnswer />
            </InfoBoard>
            <ArtBoards />
            <CSSWordCloud />

            <Editors />
          </>
        )}
      </GameContainer>
    </article>
  );
}

export default App;
