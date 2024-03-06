/** @format */

import { CSSWordCloud } from "../CSSWordCloud/CSSWordCloud";
import "./ArtBoard.css";
import { Drawboard } from "./Drawboard/Drawboard";
import { ModelBoard } from "./ModelBoard/ModelBoard";
import { BoardsContainer } from "./BoardsContainer";
import ScoreBoard from "./ScoreBoard";

const artBoardStyle = {
  position: "relative" as const,
  width: "100%",
  overflow: "hidden",
};

export const ArtBoards = (): JSX.Element => {
  return (
    <div style={artBoardStyle}>
      {/* <ScoreBoard /> */}
      <BoardsContainer>
        <Drawboard />
        <ModelBoard />
      </BoardsContainer>
      <CSSWordCloud />
    </div>
  );
};
