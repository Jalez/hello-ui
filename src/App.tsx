/** @format */

import "./App.css";

import { Navbar } from "./components/Navbar/Navbar";
import { Editors } from "./components/Editors/Editors";
import { ArtBoards } from "./components/ArtBoards/ArtBoards";
import Instruction from "./components/Help/Instruction";
import { LevelUpdater } from "./LevelUpdater";
import { GameContainer } from "./GameContainer";
import { Slider } from "./components/ArtBoards/Drawboard/ImageContainer/Slider/Slider";
import { InfoBoard } from "./components/InfoBoard/InfoBoard";
import { useAppDispatch, useAppSelector } from "./store/hooks/hooks";
import InfoInstructions from "./components/InfoBoard/InfoInstructions";
import { InfoQuestionAndAnswer } from "./components/InfoBoard/InfoQuestionAndAnswer";
import { CSSWordCloud } from "./components/CSSWordCloud/CSSWordCloud";
import { useEffect } from "react";
import levelsSlice, { updateWeek } from "./store/slices/levels.slice";

const AppStyle = {
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  alignItems: "center",
  position: "relative" as const,
  width: "100%",
  height: "100vh",
  border: "10px solid black",
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
    console.log("APP MOUNTED");
    // once it's mounted, send a message to the parent window
    window.parent.postMessage(
      {
        message: "loaded",
      },
      "*"
    );

    // listen for messages from the parent window
    window.addEventListener("message", (event) => {
      // console.log("EVENT", event);
      if (event.data.message === "setWeek") {
        dispatch(updateWeek(event.data.week));
      }
    });
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
