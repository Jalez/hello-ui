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
import { sendScoreToParentFrame } from "./store/actions/score.actions";
import { Footer } from "./components/Footer/Footer";

const AppStyle = {
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  alignItems: "center",
  position: "relative" as const,
  width: "100%",
  height: "100vh",
  // border: "10px solid black",
};

function App() {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);

  useEffect(() => {
    // once it's mounted, send a message to the parent window
    // look at the url params to determine the week
    const urlParams = new URLSearchParams(window.location.search);
    let week = urlParams.get("week");

    dispatch(updateWeek(week));
    dispatch(sendScoreToParentFrame());
  }, []);

  return (
    <>
      <Instruction />
      <article id="App" style={AppStyle}>
        <LevelUpdater />
        <GameContainer>
          {levels.length > 0 && (
            <>
              <Navbar />

              <section>
                {/* <InfoBoard> */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <InfoInstructions />
                  <ArtBoards />
                </div>
                {/* <InfoQuestionAndAnswer /> */}
              </section>

              {/* </InfoBoard> */}
              {options.showWordCloud && <CSSWordCloud />}

              <Editors />
              <Footer />
            </>
          )}
        </GameContainer>
      </article>
    </>
  );
}

export default App;
