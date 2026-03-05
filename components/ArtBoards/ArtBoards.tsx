/** @format */
'use client';

import { BoardsContainer } from "./BoardsContainer";
import { useAppSelector } from "@/store/hooks/hooks";
import { KeyBindings } from "@/components/Editors/KeyBindings";
import ScenarioAdder from "./ScenarioAdder";
import SidebySideArt from "./SidebySideArt";
import DrawBoard from "./Drawboard/DrawBoard";
import ModelBoard from "./ModelBoard/ModelBoard";
import { useRef } from "react";



export const ArtBoards = (): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const containerRef = useRef<HTMLDivElement>(null);

  // Early return if level doesn't exist - parent handles loading state
  if (!level) {
    return null;
  }

  const showHotkeys = level.showHotkeys;
  const scenarios = level.scenarios;
  
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }

  const artContents = [<ModelBoard key="model" />, <DrawBoard key="draw" />];

  return (
    <>
      <div ref={containerRef} className="w-full h-full relative">
        <BoardsContainer>
          <SidebySideArt contents={artContents} />

          {showHotkeys && <KeyBindings />}
        </BoardsContainer>
        <div className="absolute bottom-0 right-0 z-[100]">
          <ScenarioAdder />
        </div>
      </div>
    </>
  );
};
