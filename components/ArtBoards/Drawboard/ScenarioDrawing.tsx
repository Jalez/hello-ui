'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Image } from "@/components/General/Image/Image";
import { ArtContainer } from "../ArtContainer";
import { Frame } from "../Frame";
import "./Drawboard.css";
import { SlideShower } from "./ImageContainer/SlideShower";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { Button } from "@/components/ui/button";
import { scenario } from "@/types";
import { useCallback, useState } from "react";
import { toggleImageInteractivity } from "@/store/slices/levels.slice";
import { MousePointer, ImageIcon } from "lucide-react";
import PoppingTitle from "@/components/General/PoppingTitle";
import { ScenarioDimensionsWrapper } from "./ScenarioDimensionsWrapper";
import { ScenarioHoverContainer } from "./ScenarioHoverContainer";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";

type ScenarioDrawingProps = {
  scenario: scenario;
  allowScaling?: boolean;
};

export const ScenarioDrawing = ({
  scenario,
  allowScaling = false,
}: ScenarioDrawingProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutionUrls = useAppSelector((state) => state.solutionUrls as Record<string, string>);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string>);
  const solutionUrl = solutionUrls[scenario.scenarioId];
  const drawingUrl = drawingUrls[scenario.scenarioId];
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [showInteractivePreview, setShowInteractivePreview] = useState(false);
  const [hasExplicitPreviewChoice, setHasExplicitPreviewChoice] = useState(false);
  const css = level?.code.css ?? "";
  const html = level?.code.html ?? "";
  const js = level?.code.js ?? "";
  const shouldShowInteractivePreview =
    isCreator && (showInteractivePreview || (!hasExplicitPreviewChoice && !drawingUrl));

  const handleSwitchDrawing = useCallback(() => {
    if (isCreator) {
      setHasExplicitPreviewChoice(true);
      setShowInteractivePreview((currentValue) => !currentValue);
    } else {
      dispatch(toggleImageInteractivity(currentLevel));
      syncLevelFields(currentLevel - 1, ["interactive"]);
    }
  }, [currentLevel, dispatch, isCreator, syncLevelFields]);
  const interactive = level?.interactive ?? false;

  if (!level) return null;

  return (
    <div className="relative flex h-full min-h-0 w-full justify-center">
      <BoardContainer
        width={scenario.dimensions.width}
        height={scenario.dimensions.height}
        allowScaling={allowScaling}
      >
        {/* <BoardTitle>Your version</BoardTitle> */}
        <Board>
          {" "}
          <ArtContainer>
            <div className="relative">
              {isCreator && (
                <ScenarioHoverContainer>
                  <div className="relative h-full w-full min-h-[1px]">
                    <ScenarioDimensionsWrapper
                      scenario={scenario}
                      levelId={currentLevel}
                      showDimensions={true}
                      setShowDimensions={() => {}}
                      toolbarEnd={
                        <PoppingTitle topTitle={showInteractivePreview ? "Switch to Static" : "Switch to Interactive"}>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={handleSwitchDrawing}
                          >
                            {showInteractivePreview ? <ImageIcon className="h-4 w-4" /> : <MousePointer className="h-4 w-4" />}
                          </Button>
                        </PoppingTitle>
                      }
                    />
                  </div>
                </ScenarioHoverContainer>
              )}
              {!isCreator && (
                <div className="absolute top-2 right-2 z-10">
                  <PoppingTitle topTitle={interactive ? "Switch to Static" : "Switch to Interactive"}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 bg-background/80 hover:bg-background"
                      onClick={handleSwitchDrawing}
                    >
                      {interactive ? <ImageIcon className="h-4 w-4" /> : <MousePointer className="h-4 w-4" />}
                    </Button>
                  </PoppingTitle>
                </div>
              )}
              <SlideShower
                sliderHeight={scenario.dimensions.height}
                showStatic={!interactive && !isCreator}
                staticComponent={
                  <Image
                    imageUrl={solutionUrl}
                    height={scenario.dimensions.height}
                    width={scenario.dimensions.width}
                  />
                }
                slidingComponent={
                  <div
                    className="overflow-hidden relative"
                    style={{
                      height: `${scenario.dimensions.height}px`,
                      width: `${scenario.dimensions.width}px`,
                    }}
                  >
                    {isCreator ? (
                      <>
                        <Frame
                          id="DrawBoard"
                          events={level.events || []}
                          newCss={css}
                          newHtml={html}
                          newJs={js + "\n" + scenario.js}
                          scenario={scenario}
                          name="drawingUrl"
                          hiddenFromView={!shouldShowInteractivePreview}
                        />
                        {!shouldShowInteractivePreview && (
                          <Image
                            name="drawing"
                            imageUrl={drawingUrl}
                            height={scenario.dimensions.height}
                            width={scenario.dimensions.width}
                          />
                        )}
                      </>
                    ) : (
                      <Frame
                        id="DrawBoard"
                        events={level.events || []}
                        newCss={css}
                        newHtml={html}
                        newJs={js + "\n" + scenario.js}
                        scenario={scenario}
                        name="drawingUrl"
                      />
                    )}
                  </div>
                }
              />
            </div>
          </ArtContainer>
        </Board>
      </BoardContainer>
    </div>
  );
};
