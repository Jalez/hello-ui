/** @format */

import "./App.css";

import { Navbar } from "./components/Navbar/Navbar";
import { Editors } from "./components/Editors/Editors";
import { ArtBoards } from "./components/ArtBoards/ArtBoards";
import Instruction from "./components/Help/Instruction";
import { LevelUpdater } from "./LevelUpdater";
import { GameContainer } from "./GameContainer";
import { Slider } from "./components/ArtBoards/Drawboard/ImageContainer/Slider/Slider";

const AppStyle = {
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
  alignItems: "center",
  position: "relative" as const,
  width: "100%",
  height: "100vh",
  backgroundColor: "yellow",
  maxHeight: "100vh",
};

function App() {
  const onSliderDrag = (value: number) => {
    console.log("slider dragged", value);
  };

  return (
    <div id="App" style={AppStyle}>
      <LevelUpdater />
      <Instruction />
      <GameContainer>
        <Navbar />
        <ArtBoards />

        <Editors />
      </GameContainer>
    </div>
  );
}

export default App;
