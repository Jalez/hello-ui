/** @format */
"use client";

import { Diff } from "./Diff/Diff";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { ModelArtContainer } from "./ModelArtContainer";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";
import { Image } from "@/components/General/Image/Image";
import { DiffModelToggleContent } from "@/components/General/FloatingActionButton";
import { DraggableFloatingPanel } from "@/components/General/DraggableFloatingPanel";
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
  const [modelToolbarDragStarted, setModelToolbarDragStarted] = useState(false);
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
                <DraggableFloatingPanel
                  showOnHover
                  storageKey={`floating-button-model-${scenario.scenarioId}`}
                  defaultPosition={{ x: -16, y: 16 }}
                  onDragStateChange={setModelToolbarDragStarted}
                >
                  <div className="flex flex-row items-center gap-3 rounded-lg border border-border/60 bg-background/85 px-3 py-2 text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-background/95">
                    <div className="shrink-0">
                      <PoppingTitle topTitle={showInteractivePreview ? "Switch to Static" : "Switch to Interactive"}>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setHasExplicitPreviewChoice(true);
                            setShowInteractivePreview((currentValue) => !currentValue);
                          }}
                        >
                          {showInteractivePreview ? <ImageIcon className="h-4 w-4" /> : <MousePointer className="h-4 w-4" />}
                        </Button>
                      </PoppingTitle>
                    </div>
                    {!shouldShowInteractivePreview && (
                      <>
                        <div className="h-8 w-px shrink-0 bg-border/60" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <DiffModelToggleContent
                            dragStarted={modelToolbarDragStarted}
                            leftLabel="diff"
                            rightLabel="model"
                            checked={showModel}
                            onCheckedChange={handleSwitchModel}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </DraggableFloatingPanel>
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
