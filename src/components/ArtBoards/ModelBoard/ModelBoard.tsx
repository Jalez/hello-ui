/** @format */

import { Diff } from "./Diff/Diff";
import { BoardContainer } from "../BoardContainer";
import { BoardTitle } from "../BoardTitle";
import { Board } from "../Board";
import { ModelArtContainer } from "./ModelArtContainer";
import { Model } from "./Model";
import { useAppSelector } from "../../../store/hooks/hooks";

export const ModelBoard = (): JSX.Element => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const showModel = level.showModelPicture;

  return (
    <BoardContainer>
      <Board>
        {/* <ModelInfoBoard showModel={showModel} setShowModel={setShowModel} /> */}
        <ModelArtContainer>
          {showModel ? <Model /> : <Diff />}
        </ModelArtContainer>
      </Board>
      <BoardTitle side="right">Model version</BoardTitle>
    </BoardContainer>
  );
};
