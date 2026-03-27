/** @format */
'use client';

import { Diff } from "./Diff/Diff";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { ModelArtContainer } from "./ModelArtContainer";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";
import { Image } from "@/components/General/Image/Image";
import { FloatingActionButton } from "@/components/General/FloatingActionButton";
import { useCallback, useState } from "react";
import { toggleShowModelSolution } from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { Button } from "@/components/ui/button";
import PoppingTitle from "@/components/General/PoppingTitle";
import { ImageIcon, MousePointer } from "lucide-react";

type ScenarioModelProps = {
  scenario: scenario;
  allowScaling?: boolean;
};

export const ScenarioModel = ({
  scenario,
  allowScaling = false,
}: ScenarioModelProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const showModel = level.showModelPicture;
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();
  const solutionUrls = useAppSelector((state) => state.solutionUrls as Record<string, string>);
  const solutionUrl = solutionUrls[scenario.scenarioId];
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [showInteractivePreview, setShowInteractivePreview] = useState(false);
  const [hasExplicitPreviewChoice, setHasExplicitPreviewChoice] = useState(false);
  const shouldShowInteractivePreview =
    isCreator && (showInteractivePreview || (!hasExplicitPreviewChoice && !solutionUrl));

  const handleSwitchModel = useCallback(() => {
    dispatch(toggleShowModelSolution(currentLevel));
    syncLevelFields(currentLevel - 1, ["showModelPicture"]);
  }, [currentLevel, dispatch, syncLevelFields]);

  return (
    <div className="relative flex h-full min-h-0 w-full justify-center">
      <BoardContainer
        width={scenario.dimensions.width}
        height={scenario.dimensions.height}
        allowScaling={allowScaling}
      >
        <Board>
          <ModelArtContainer
            scenario={scenario}
            showInteractivePreview={shouldShowInteractivePreview}
          >
            <div className="relative">
              {isCreator && (
                <div className="absolute top-2 right-2 z-20">
                  <PoppingTitle topTitle={showInteractivePreview ? "Switch to Static" : "Switch to Interactive"}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 bg-background/80 hover:bg-background"
                      onClick={() => {
                        setHasExplicitPreviewChoice(true);
                        setShowInteractivePreview((currentValue) => !currentValue);
                      }}
                    >
                      {showInteractivePreview ? <ImageIcon className="h-4 w-4" /> : <MousePointer className="h-4 w-4" />}
                    </Button>
                  </PoppingTitle>
                </div>
              )}
              {!shouldShowInteractivePreview && (
                <>
                  {showModel && solutionUrl ? (
                    <Image
                      name="solution"
                      imageUrl={solutionUrl}
                      height={scenario.dimensions.height}
                      width={scenario.dimensions.width}
                    />
                  ) : (
                    <Diff scenario={scenario} />
                  )}
                  <FloatingActionButton
                    leftLabel="diff"
                    rightLabel="model"
                    checked={showModel}
                    onCheckedChange={handleSwitchModel}
                    tooltip="Toggle between difference view and model image"
                    showOnHover={true}
                    storageKey={`floating-button-model-${scenario.scenarioId}`}
                  />
                </>
              )}
            </div>
          </ModelArtContainer>
        </Board>
        {/* <BoardTitle side="right">Model version</BoardTitle> */}
      </BoardContainer>
    </div>
  );
};
