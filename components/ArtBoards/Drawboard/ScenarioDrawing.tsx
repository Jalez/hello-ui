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
import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalDrawboardNavbarCapture } from "@/components/ArtBoards/DrawboardNavbarCaptureContext";
import { toggleImageInteractivity } from "@/store/slices/levels.slice";
import { Camera, Loader2, MousePointer, ImageIcon } from "lucide-react";
import type { FrameHandle } from "@/components/ArtBoards/Frame";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { ScenarioDimensionsWrapper } from "./ScenarioDimensionsWrapper";
import { ScenarioHoverContainer } from "./ScenarioHoverContainer";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";

/** One bootstrap per level across all mounted clones (SidebySideArt mounts several instances). */
let playwrightGameInteractiveBootstrappedLevel: number | null = null;

type ScenarioDrawingProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
};

export const ScenarioDrawing = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
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
  const [drawingCaptureBusy, setDrawingCaptureBusy] = useState(false);
  const drawingFrameRef = useRef<FrameHandle | null>(null);
  const captureNav = useOptionalDrawboardNavbarCapture();
  const { drawboardCaptureMode, manualDrawboardCapture } = useGameRuntimeConfig();

  const bindDrawingFrame = useCallback(
    (instance: FrameHandle | null) => {
      drawingFrameRef.current = instance;
      if (registerForNavbarCapture) {
        captureNav?.registerDrawingFrame(instance);
      }
    },
    [registerForNavbarCapture, captureNav],
  );

  useEffect(() => {
    return () => {
      if (registerForNavbarCapture) {
        captureNav?.registerDrawingFrame(null);
      }
    };
  }, [registerForNavbarCapture, captureNav]);

  const handleDrawingCaptureBusy = useCallback(
    (busy: boolean) => {
      setDrawingCaptureBusy(busy);
      if (registerForNavbarCapture) {
        captureNav?.notifyDrawingBusy(busy);
      }
    },
    [captureNav, registerForNavbarCapture],
  );
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

  useEffect(() => {
    if (!level) {
      return;
    }
    if (isCreator) {
      return;
    }
    if (drawboardCaptureMode !== "playwright") {
      return;
    }
    if (playwrightGameInteractiveBootstrappedLevel === currentLevel) {
      return;
    }
    if (!level.interactive) {
      dispatch(toggleImageInteractivity(currentLevel));
      syncLevelFields(currentLevel - 1, ["interactive"]);
    }
    playwrightGameInteractiveBootstrappedLevel = currentLevel;
  }, [currentLevel, dispatch, drawboardCaptureMode, isCreator, level, syncLevelFields]);

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
                <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-2">
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
                  {manualDrawboardCapture && interactive && (
                    <PoppingTitle topTitle="Capture picture from your preview">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 bg-background/90 shadow-sm"
                        disabled={drawingCaptureBusy}
                        aria-label="Capture picture from your preview"
                        onClick={() => drawingFrameRef.current?.requestCapture()}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </PoppingTitle>
                  )}
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
                    loadingMessage="Loading reference image…"
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
                          ref={bindDrawingFrame}
                          id="DrawBoard"
                          events={level.events || []}
                          newCss={css}
                          newHtml={html}
                          newJs={js + "\n" + scenario.js}
                          scenario={scenario}
                          name="drawingUrl"
                          hiddenFromView={!shouldShowInteractivePreview}
                          onCaptureBusyChange={handleDrawingCaptureBusy}
                        />
                        {!shouldShowInteractivePreview && (
                          <div className="relative z-[1]">
                            <Image
                              name="drawing"
                              imageUrl={drawingUrl}
                              height={scenario.dimensions.height}
                              width={scenario.dimensions.width}
                              loadingMessage="Loading your design…"
                            />
                          </div>
                        )}
                        {manualDrawboardCapture && !shouldShowInteractivePreview && (
                          <div className="absolute top-2 right-2 z-30">
                            <PoppingTitle topTitle="Capture picture from your design">
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7 bg-background/90 shadow-sm"
                                disabled={drawingCaptureBusy}
                                aria-label="Capture picture from your design"
                                onClick={() => drawingFrameRef.current?.requestCapture()}
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            </PoppingTitle>
                          </div>
                        )}
                        {manualDrawboardCapture && shouldShowInteractivePreview && (
                          <div className="absolute top-2 right-2 z-30">
                            <PoppingTitle topTitle="Capture picture from your preview">
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7 bg-background/90 shadow-sm"
                                disabled={drawingCaptureBusy}
                                aria-label="Capture picture from your preview"
                                onClick={() => drawingFrameRef.current?.requestCapture()}
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            </PoppingTitle>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <Frame
                          ref={bindDrawingFrame}
                          id="DrawBoard"
                          events={level.events || []}
                          newCss={css}
                          newHtml={html}
                          newJs={js + "\n" + scenario.js}
                          scenario={scenario}
                          name="drawingUrl"
                          hiddenFromView={!interactive}
                          onCaptureBusyChange={handleDrawingCaptureBusy}
                        />
                        {!interactive && (
                          <div className="relative z-[1]">
                            <Image
                              name="drawing"
                              imageUrl={drawingUrl}
                              height={scenario.dimensions.height}
                              width={scenario.dimensions.width}
                              loadingMessage="Loading your design…"
                            />
                          </div>
                        )}
                      </>
                    )}
                    {drawingCaptureBusy
                      && (!isCreator || shouldShowInteractivePreview) && (
                      <div
                        className="absolute inset-0 z-20 flex items-center justify-center bg-background/55 backdrop-blur-[1px]"
                        aria-busy
                        aria-label="Generating picture"
                      >
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
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
