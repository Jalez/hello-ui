/** @format */
"use client";

// ModelArtContainer.tsx
import type { Ref } from "react";
import { Frame, type FrameHandle } from "../Frame";
import { ArtContainer } from "../ArtContainer";
import { useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";
import { Spinner } from "@/components/General/Spinner/Spinner";

type LegacySolution = {
  SCSS: string;
  SHTML: string;
  SJS: string;
  drawn: boolean;
};

type ModelArtContainerProps = {
  children: React.ReactNode;
  scenario: scenario;
  showInteractivePreview?: boolean;
  frameRef?: Ref<FrameHandle>;
  onCaptureBusyChange?: (busy: boolean) => void;
  /** When false (game), the solution iframe is removed after the first capture so the live solution is never visible. */
  isCreator?: boolean;
  solutionUrl?: string;
};

export const ModelArtContainer = ({
  children,
  scenario,
  showInteractivePreview = false,
  frameRef,
  onCaptureBusyChange,
  isCreator = true,
  solutionUrl = "",
}: ModelArtContainerProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutions = useAppSelector((state) => state.solutions as unknown as Record<string, LegacySolution>);
  if (!level) return null;

  const defaultLevelSolutions = solutions[level.name]
    ? {
        css: solutions[level.name].SCSS,
        html: solutions[level.name].SHTML,
        js: solutions[level.name].SJS,
      }
    : null;
  const levelSolution = level.solution || { css: "", html: "", js: "" };
  const solutionCSS = levelSolution.css || defaultLevelSolutions?.css || "";
  const solutionHTML = levelSolution.html || defaultLevelSolutions?.html || "";
  const solutionJS = levelSolution.js || defaultLevelSolutions?.js || "";

  const hasSolutionCapture = Boolean(solutionUrl?.trim());
  const mountSolutionFrame = isCreator || !hasSolutionCapture;

  return (
    <ArtContainer
      width={scenario.dimensions.width}
      height={scenario.dimensions.height}
    >
      {mountSolutionFrame && (
        <Frame
          ref={frameRef}
          id="DrawBoard"
          newCss={solutionCSS}
          newHtml={solutionHTML}
          newJs={solutionJS + "\n" + scenario.js}
          events={level.events || []}
          scenario={scenario}
          name="solutionUrl"
          hiddenFromView={!showInteractivePreview}
          onCaptureBusyChange={onCaptureBusyChange}
        />
      )}
      {children}
      {!isCreator && !hasSolutionCapture && (
        <div
          className="absolute inset-0 z-[50] flex items-center justify-center bg-background"
          aria-busy
          aria-label="Preparing reference"
        >
          <Spinner
            height={scenario.dimensions.height}
            width={scenario.dimensions.width}
            message="Preparing reference…"
          />
        </div>
      )}
    </ArtContainer>
  );
};
