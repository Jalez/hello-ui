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
import { useAppSelector } from "./store/hooks/hooks";
import InfoInstructions from "./components/InfoBoard/InfoInstructions";
import { InfoQuestionAndAnswer } from "./components/InfoBoard/InfoQuestionAndAnswer";
import { CSSWordCloud } from "./components/CSSWordCloud/CSSWordCloud";

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
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  return (
    <article id="App" style={AppStyle}>
      <LevelUpdater />
      <Instruction />
      <GameContainer>
        <Navbar />
        <div
        // style={{
        //   zIndex: 10,
        // }}
        >
          <InfoBoard>
            <InfoInstructions />
            <InfoQuestionAndAnswer />
          </InfoBoard>
        </div>
        <ArtBoards />
        <CSSWordCloud />

        <Editors />
      </GameContainer>
    </article>
  );
}

export default App;
